import { Router } from 'express';
import { Address, nativeToScVal, Keypair } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import {
  buildScoreSummary,
  computeDaysRemaining,
  estimateDueDateFromLedgers,
  getPoolSnapshot,
  tierFeeBps,
  toPhpAmount,
  toStroops,
} from '../scoring/engine';
import { buildUnsignedContractCall } from '../stellar/feebump';
import { queryContract, getLoanFromChain, hasActiveLoan } from '../stellar/query';
import { contractIds, rpcServer } from '../stellar/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ensureDemoWalletReady } from '../stellar/demo';

const router = Router();

async function getWalletTokenBalance(walletAddress: string) {
  const result = await queryContract<bigint | number | string>(contractIds.phpcToken, 'balance', [
    Address.fromString(walletAddress).toScVal(),
  ]);
  return BigInt(result ?? 0);
}

router.post(
  '/borrow',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Invalid amount');
    }

    const wallet = req.wallet;

    if (config.stellarNetwork !== 'PUBLIC') {
      await ensureDemoWalletReady(Keypair.fromPublicKey(wallet));
    }

    if (await hasActiveLoan(wallet)) {
      throw badRequest('Active loan already exists');
    }

    const score = await buildScoreSummary(wallet);
    if (score.tier < 1) {
      throw badRequest('No active credit tier');
    }

    const amountStroops = toStroops(amount);
    if (amountStroops > BigInt(score.borrowLimitRaw)) {
      throw badRequest('Amount exceeds tier limit');
    }

    const poolSnapshot = await getPoolSnapshot();
    if (BigInt(poolSnapshot.poolBalanceRaw) < amountStroops) {
      throw badRequest('Insufficient pool liquidity');
    }

    const args = [
      Address.fromString(wallet).toScVal(),
      nativeToScVal(amountStroops, { type: 'i128' }),
    ];

    const feeBps = tierFeeBps(score.tier);
    const feeAmount = amount * (feeBps / 10_000);
    const preview = {
      amount: amount.toFixed(2),
      fee: feeAmount.toFixed(2),
      feeBps,
      totalOwed: (amount + feeAmount).toFixed(2),
      tier: score.tier,
      tierLabel: score.tierLabel,
    };

    const unsignedXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'borrow',
      args,
    );

    type BorrowResponse = {
      requiresSignature: true;
      unsignedXdr: string;
      preview: {
        amount: string;
        fee: string;
        feeBps: number;
        totalOwed: string;
        tier: number;
        tierLabel: string;
      };
    };

    logger.info({ wallet, amount, feeBps: preview.feeBps }, 'Borrow transaction prepared');
    const response: BorrowResponse = {
      requiresSignature: true,
      unsignedXdr,
      preview,
    };
    return res.json(response);
  }),
);

router.post(
  '/repay',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const loan = await getLoanFromChain(wallet);

    if (!loan) {
      throw badRequest('No active loan found');
    }
    if (loan.repaid) {
      throw badRequest('Loan already repaid');
    }
    if (loan.defaulted) {
      throw badRequest('This loan has been defaulted and cannot be repaid');
    }

    const totalOwedStroops = loan.principal + loan.fee;
    const walletBalanceStroops = await getWalletTokenBalance(wallet);
    if (walletBalanceStroops < totalOwedStroops) {
      const shortfall = totalOwedStroops - walletBalanceStroops;
      return res.status(422).json({
        error: 'InsufficientBalance',
        shortfall: toPhpAmount(shortfall),
        walletBalance: toPhpAmount(walletBalanceStroops),
        totalOwed: toPhpAmount(totalOwedStroops),
      });
    }

    const latestLedger = await rpcServer.getLatestLedger();
    const expirationLedger = latestLedger.sequence + config.approvalLedgerWindow;

    const approveArgs = [
      Address.fromString(wallet).toScVal(),
      Address.fromString(contractIds.lendingPool).toScVal(),
      nativeToScVal(totalOwedStroops, { type: 'i128' }),
      nativeToScVal(expirationLedger, { type: 'u32' }),
    ];

    const unsignedApproveXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.phpcToken,
      'approve',
      approveArgs,
    );

    const summary = {
      principal: toPhpAmount(loan.principal),
      fee: toPhpAmount(loan.fee),
      totalOwed: toPhpAmount(totalOwedStroops),
      walletPhpcBalance: toPhpAmount(walletBalanceStroops),
    };

    type RepayResponse = {
      requiresSignature: true;
      transactions: Array<{
        type: 'approve';
        unsignedXdr: string;
        description: string;
      }>;
      summary: {
        principal: string;
        fee: string;
        totalOwed: string;
        walletPhpcBalance: string;
      };
    };

    logger.info({ wallet, totalOwed: summary.totalOwed }, 'Repay approval prepared');
    const response: RepayResponse = {
      requiresSignature: true,
      transactions: [
        {
          type: 'approve',
          unsignedXdr: unsignedApproveXdr,
          description: `Authorize pool to spend ${toPhpAmount(totalOwedStroops)} PHPC`,
        },
      ],
      summary,
    };
    return res.json(response);
  }),
);

router.post(
  '/repay-xdr',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const loan = await getLoanFromChain(wallet);

    if (!loan || loan.repaid || loan.defaulted) {
      throw badRequest('No repayable loan found');
    }

    // Build against the CURRENT sequence number — approve has already settled by now
    const unsignedRepayXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'repay',
      [Address.fromString(wallet).toScVal()],
    );

    res.json({ unsignedXdr: unsignedRepayXdr });
  }),
);

router.get(
  '/status',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const [loan, poolSnapshot, latestLedger, walletBalanceStroops] = await Promise.all([
      getLoanFromChain(wallet),
      getPoolSnapshot(),
      rpcServer.getLatestLedger(),
      getWalletTokenBalance(wallet),
    ]);

    if (!loan) {
      return res.json({
        hasActiveLoan: false,
        poolBalance: poolSnapshot.poolBalance,
        loan: null,
      });
    }

    const currentLedger = latestLedger.sequence;
    const dueLedger = loan.due_ledger;
    const daysRemaining = computeDaysRemaining(currentLedger, dueLedger);
    const status = loan.repaid
      ? 'repaid'
      : loan.defaulted
        ? 'defaulted'
        : currentLedger > dueLedger
          ? 'overdue'
          : 'active';

    const hasActiveLoan = status === 'active' || status === 'overdue';

    type LoanStatusResponse = {
      hasActiveLoan: boolean;
      poolBalance: string;
      loan: {
        principal: string;
        fee: string;
        totalOwed: string;
        walletBalance: string;
        shortfall: string;
        dueLedger: number;
        currentLedger: number;
        dueDate: string;
        daysRemaining: number;
        status: 'repaid' | 'defaulted' | 'overdue' | 'active';
        repaid: boolean;
        defaulted: boolean;
      } | null;
    };

    const response: LoanStatusResponse = {
      hasActiveLoan,
      poolBalance: poolSnapshot.poolBalance,
      loan: loan
        ? {
            principal: toPhpAmount(loan.principal),
            fee: toPhpAmount(loan.fee),
            totalOwed: toPhpAmount(loan.principal + loan.fee),
            walletBalance: toPhpAmount(walletBalanceStroops),
            shortfall:
              walletBalanceStroops < loan.principal + loan.fee
                ? toPhpAmount(loan.principal + loan.fee - walletBalanceStroops)
                : '0.00',
            dueLedger,
            currentLedger,
            dueDate: estimateDueDateFromLedgers(daysRemaining),
            daysRemaining,
            status,
            repaid: loan.repaid,
            defaulted: loan.defaulted,
          }
        : null,
    };

    return res.json(response);
  }),
);

export default router;
