import { Router } from 'express';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
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

const router = Router();

async function getWalletTokenBalance(walletAddress: string) {
  const result = await queryContract(contractIds.phpcToken, 'balance', [
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

    return res.json({
      requiresSignature: true,
      unsignedXdr,
      preview,
    });
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

    const repayArgs = [Address.fromString(wallet).toScVal()];

    const unsignedApproveXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.phpcToken,
      'approve',
      approveArgs,
    );

    const unsignedRepayXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'repay',
      repayArgs,
    );

    return res.json({
      requiresSignature: true,
      transactions: [
        {
          type: 'approve',
          unsignedXdr: unsignedApproveXdr,
          description: `Authorize pool to spend ${toPhpAmount(totalOwedStroops)} PHPC`,
        },
        {
          type: 'repay',
          unsignedXdr: unsignedRepayXdr,
          description: 'Repay loan principal + fee',
        },
      ],
      summary: {
        principal: toPhpAmount(loan.principal),
        fee: toPhpAmount(loan.fee),
        totalOwed: toPhpAmount(totalOwedStroops),
        walletPhpcBalance: toPhpAmount(walletBalanceStroops),
      },
    });
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

    return res.json({
      hasActiveLoan,
      poolBalance: poolSnapshot.poolBalance,
      loan: {
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
      },
    });
  }),
);

export default router;
