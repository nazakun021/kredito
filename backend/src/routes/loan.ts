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
  toXlmAmount,
  toStroops,
} from '../scoring/engine';
import { buildUnsignedContractCall } from '../stellar/feebump';
import { getLoanFromChain, hasActiveLoan } from '../stellar/query';
import { contractIds, horizonServer, rpcServer } from '../stellar/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ensureDemoWalletReady } from '../stellar/demo';

const router = Router();

async function getWalletXlmBalance(walletAddress: string) {
  try {
    const account = await horizonServer.loadAccount(walletAddress);
    const native = account.balances.find((b) => b.asset_type === 'native');
    return toStroops(Number(native?.balance || 0));
  } catch {
    return 0n;
  }
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

    // KYC enforcement: Silver (2), Gold (3), Platinum (4) require KYC
    if (score.tier >= 2 && !score.kycVerified) {
      throw badRequest('KYC verification required for this tier');
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
    const walletBalanceStroops = await getWalletXlmBalance(wallet);
    if (walletBalanceStroops < totalOwedStroops) {
      const shortfall = totalOwedStroops - walletBalanceStroops;
      return res.status(422).json({
        error: 'InsufficientBalance',
        shortfall: toXlmAmount(shortfall),
        walletBalance: toXlmAmount(walletBalanceStroops),
        totalOwed: toXlmAmount(totalOwedStroops),
      });
    }

    const unsignedXdr = await buildUnsignedContractCall(wallet, contractIds.lendingPool, 'repay', [
      Address.fromString(wallet).toScVal(),
    ]);

    const summary = {
      principal: toXlmAmount(loan.principal),
      fee: toXlmAmount(loan.fee),
      totalOwed: toXlmAmount(totalOwedStroops),
      walletBalance: toXlmAmount(walletBalanceStroops),
    };

    type RepayResponse = {
      requiresSignature: true;
      unsignedXdr: string;
      summary: {
        principal: string;
        fee: string;
        totalOwed: string;
        walletBalance: string;
      };
    };

    logger.info({ wallet, totalOwed: summary.totalOwed }, 'Repay transaction prepared');
    const response: RepayResponse = {
      requiresSignature: true,
      unsignedXdr,
      summary,
    };
    return res.json(response);
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
      getWalletXlmBalance(wallet),
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
            principal: toXlmAmount(loan.principal),
            fee: toXlmAmount(loan.fee),
            totalOwed: toXlmAmount(loan.principal + loan.fee),
            walletBalance: toXlmAmount(walletBalanceStroops),
            shortfall:
              walletBalanceStroops < loan.principal + loan.fee
                ? toXlmAmount(loan.principal + loan.fee - walletBalanceStroops)
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
