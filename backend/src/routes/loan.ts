import { Router } from 'express';
import { Address, Keypair, nativeToScVal } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import { asyncRoute, badRequest } from '../errors';
import { decrypt } from '../utils/crypto';
import {
  buildScoreSummary,
  computeDaysRemaining,
  estimateDueDateFromLedgers,
  getPoolSnapshot,
  tierFeeBps,
  toPhpAmount,
  toStroops,
} from '../scoring/engine';
import { buildAndSubmitFeeBump, buildUnsignedContractCall } from '../stellar/feebump';
import { queryContract } from '../stellar/query';
import { contractIds, rpcServer } from '../stellar/client';
import { updateOnChainMetrics } from '../stellar/issuer';
import { getLoanRecord, waitForLoanRepayment } from '../loan-state';
import { loadUserById } from '../users';

const router = Router();

function getExplorerUrl(txHash: string) {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

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

    const user = loadUserById(req.userId);
    const score = await buildScoreSummary(user.stellar_pub);
    const currentLoan = await getLoanRecord(user.stellar_pub);
    if (currentLoan && !currentLoan.repaid && !currentLoan.defaulted) {
      throw badRequest('Active loan already exists');
    }

    if (score.tier < 1) {
      throw badRequest('No qualifying credit tier');
    }

    const amountStroops = toStroops(amount);
    if (amountStroops > BigInt(score.borrowLimitRaw)) {
      throw badRequest('Amount exceeds tier limit');
    }

    const args = [
      Address.fromString(user.stellar_pub).toScVal(),
      nativeToScVal(amountStroops, { type: 'i128' }),
    ];

    const feeBps = tierFeeBps(score.tier);
    const feeAmount = amount * (feeBps / 10_000);
    const meta = {
      amount: amount.toFixed(2),
      fee: feeAmount.toFixed(2),
      feeBps,
      totalOwed: (amount + feeAmount).toFixed(2),
    };

    if (Boolean(user.is_external)) {
      const unsignedXdr = await buildUnsignedContractCall(
        user.stellar_pub,
        contractIds.lendingPool,
        'borrow',
        args,
      );
      return res.json({
        requiresSignature: true,
        unsignedXdr,
        meta,
      });
    }

    if (!user.stellar_enc_secret) {
      throw badRequest('Internal wallet secret is missing for this account.');
    }

    const userSecret = decrypt(user.stellar_enc_secret);
    try {
      const userKeypair = Keypair.fromSecret(userSecret);
      const txHash = await buildAndSubmitFeeBump(
        userKeypair,
        contractIds.lendingPool,
        'borrow',
        args,
      );
      db.prepare(
        'INSERT INTO active_loans (user_id, stellar_pub) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET stellar_pub = excluded.stellar_pub',
      ).run(req.userId, user.stellar_pub);

      res.json({
        txHash,
        ...meta,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        explorerUrl: getExplorerUrl(txHash),
      });
    } finally {
      userSecret.replace?.(/./g, '');
    }
  }),
);

router.post(
  '/repay',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const user = loadUserById(req.userId);
    const loan = await getLoanRecord(user.stellar_pub);

    if (!loan) {
      throw badRequest('No active loan found');
    }
    if (loan.repaid) {
      throw badRequest('Loan already repaid');
    }
    if (loan.defaulted) {
      throw badRequest('Loan already defaulted');
    }

    const totalOwedStroops = BigInt(loan.principal) + BigInt(loan.fee);
    const walletBalanceStroops = await getWalletTokenBalance(user.stellar_pub);
    if (walletBalanceStroops < totalOwedStroops) {
      const shortfall = totalOwedStroops - walletBalanceStroops;
      throw badRequest(
        `Insufficient PHPC balance to repay. You owe P${toPhpAmount(totalOwedStroops)}, but your wallet only has P${toPhpAmount(walletBalanceStroops)}. Add P${toPhpAmount(shortfall)} more PHPC to this same wallet and try again.`,
      );
    }

    const latestLedger = await rpcServer.getLatestLedger();
    const expirationLedger = latestLedger.sequence + 500;

    const approveArgs = [
      Address.fromString(user.stellar_pub).toScVal(),
      Address.fromString(contractIds.lendingPool).toScVal(),
      nativeToScVal(totalOwedStroops, { type: 'i128' }),
      nativeToScVal(expirationLedger, { type: 'u32' }),
    ];

    const repayArgs = [Address.fromString(user.stellar_pub).toScVal()];
    const previousScore = await buildScoreSummary(user.stellar_pub);

    if (Boolean(user.is_external)) {
      // Check if the approve has already been done on-chain.
      // The PHPC token panics during simulation if there is no allowance set,
      // so we must build the repay XDR only AFTER the approve is confirmed.
      let existingAllowance = 0n;
      try {
        const allowanceResult = await queryContract(contractIds.phpcToken, 'allowance', [
          Address.fromString(user.stellar_pub).toScVal(),
          Address.fromString(contractIds.lendingPool).toScVal(),
        ]);
        existingAllowance = BigInt(allowanceResult ?? 0);
      } catch {
        existingAllowance = 0n;
      }

      // Step 1: Allowance not set — return the approve XDR for the user to sign first.
      if (existingAllowance < totalOwedStroops) {
        const unsignedApproveXdr = await buildUnsignedContractCall(
          user.stellar_pub,
          contractIds.phpcToken,
          'approve',
          approveArgs,
        );
        return res.json({
          requiresSignature: true,
          step: 'approve',
          unsignedXdr: unsignedApproveXdr,
          meta: {
            amountRepaid: toPhpAmount(totalOwedStroops),
            instructions:
              'Sign and submit this approve XDR first, then call /api/loan/repay again to get the repay XDR.',
          },
        });
      }

      // Step 2: Allowance is set — now we can safely simulate and return the repay XDR.
      const unsignedRepayXdr = await buildUnsignedContractCall(
        user.stellar_pub,
        contractIds.lendingPool,
        'repay',
        repayArgs,
      );

      return res.json({
        requiresSignature: true,
        step: 'repay',
        unsignedXdr: unsignedRepayXdr,
        meta: {
          amountRepaid: toPhpAmount(totalOwedStroops),
          instructions: 'Sign and submit this repay XDR to complete the loan repayment.',
        },
      });
    }

    if (!user.stellar_enc_secret) {
      throw badRequest('Internal wallet secret is missing for this account.');
    }

    const userSecret = decrypt(user.stellar_enc_secret);
    try {
      const userKeypair = Keypair.fromSecret(userSecret);
      await buildAndSubmitFeeBump(userKeypair, contractIds.phpcToken, 'approve', approveArgs);
      const txHash = await buildAndSubmitFeeBump(
        userKeypair,
        contractIds.lendingPool,
        'repay',
        repayArgs,
      );

      const settledLoan = await waitForLoanRepayment(user.stellar_pub);
      if (!settledLoan?.repaid) {
        throw badRequest('Repayment confirmation did not settle in time. Please retry.');
      }

      db.prepare('DELETE FROM active_loans WHERE user_id = ?').run(req.userId);

      const refreshed = await buildScoreSummary(user.stellar_pub);
      await updateOnChainMetrics(user.stellar_pub, refreshed.metrics);

      db.prepare(
        `
        INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json, sbt_minted)
        VALUES (?, ?, ?, 0, ?, ?, 1)
      `,
      ).run(
        req.userId,
        refreshed.tier,
        refreshed.score,
        refreshed.score,
        JSON.stringify(refreshed),
      );

      res.json({
        txHash,
        amountRepaid: toPhpAmount(totalOwedStroops),
        previousScore: previousScore.score,
        newScore: refreshed.score,
        newTier: refreshed.tierLabel,
        newBorrowLimit: refreshed.borrowLimit,
        explorerUrl: getExplorerUrl(txHash),
      });
    } finally {
      userSecret.replace?.(/./g, '');
    }
  }),
);

router.get(
  '/status',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const user = loadUserById(req.userId);
    const [loan, poolSnapshot, latestLedger, walletBalanceStroops] = await Promise.all([
      getLoanRecord(user.stellar_pub),
      getPoolSnapshot(),
      rpcServer.getLatestLedger(),
      getWalletTokenBalance(user.stellar_pub),
    ]);

    if (!loan) {
      return res.json({
        hasActiveLoan: false,
        loan: null,
        walletPhpBalance: toPhpAmount(walletBalanceStroops),
        ...poolSnapshot,
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
      walletPhpBalance: toPhpAmount(walletBalanceStroops),
      ...poolSnapshot,
      loan: hasActiveLoan
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
          }
        : null,
    });
  }),
);

export default router;
