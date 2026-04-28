import { Router } from 'express';
import { Keypair, nativeToScVal, Address } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import { decrypt } from '../utils/crypto';
import { buildAndSubmitFeeBump } from '../stellar/feebump';
import { queryContract } from '../stellar/query';
import { contractIds, rpcServer } from '../stellar/client';
import { buildScoreSummary, tierFeeBps } from '../scoring/engine';
import { updateOnChainMetrics } from '../stellar/issuer';

const router = Router();

router.post('/borrow', authMiddleware, async (req: AuthRequest, res) => {
  const { amount } = req.body; // in PHPC units
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const user = db.prepare('SELECT stellar_pub, stellar_enc_secret FROM users WHERE id = ?').get(req.userId) as any;
  const userSecret = decrypt(user.stellar_enc_secret);
  const userKeypair = Keypair.fromSecret(userSecret);

  try {
    const scoreSummary = await buildScoreSummary(user.stellar_pub);
    const feeBps = tierFeeBps(scoreSummary.tier);
    const stroops = BigInt(Math.floor(amount * 10_000_000));
    const txHash = await buildAndSubmitFeeBump(
      userKeypair,
      contractIds.lendingPool,
      'borrow',
      [
        Address.fromString(user.stellar_pub).toScVal(),
        nativeToScVal(stroops, { type: 'i128' }),
      ]
    );

    // Update DB cache
    db.prepare('INSERT INTO active_loans (user_id, stellar_pub) VALUES (?, ?)').run(req.userId, user.stellar_pub);

    res.json({
      txHash,
      amount: amount.toFixed(2),
      fee: (amount * (feeBps / 10_000)).toFixed(2),
      totalOwed: (amount * (1 + feeBps / 10_000)).toFixed(2),
      feeBps,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/repay', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare('SELECT stellar_pub, stellar_enc_secret FROM users WHERE id = ?').get(req.userId) as any;
  const userSecret = decrypt(user.stellar_enc_secret);
  const userKeypair = Keypair.fromSecret(userSecret);

  try {
    // 1. Get loan details to know total_owed
    const loan = await queryContract(
      contractIds.lendingPool,
      'get_loan',
      [Address.fromString(user.stellar_pub).toScVal()]
    );

    if (!loan) {
      return res.status(400).json({ error: 'No active loan found' });
    }

    if (loan.repaid) {
      return res.status(400).json({ error: 'Loan already repaid' });
    }

    const totalOwedStroops = loan.principal + loan.fee;

    // 2. Approve PHPC transfer
    await buildAndSubmitFeeBump(
      userKeypair,
      contractIds.phpcToken,
      'approve',
      [
        Address.fromString(user.stellar_pub).toScVal(),
        Address.fromString(contractIds.lendingPool).toScVal(),
        nativeToScVal(totalOwedStroops, { type: 'i128' }),
        nativeToScVal(1000000, { type: 'u32' }), // expiration
      ]
    );

    // 3. Repay
    const txHash = await buildAndSubmitFeeBump(
      userKeypair,
      contractIds.lendingPool,
      'repay',
      [Address.fromString(user.stellar_pub).toScVal()]
    );

    // Update DB cache
    db.prepare('DELETE FROM active_loans WHERE user_id = ?').run(req.userId);

    let refreshedScore = null;
    try {
      const summary = await buildScoreSummary(user.stellar_pub);
      await updateOnChainMetrics(user.stellar_pub, summary.metrics);
      refreshedScore = summary;
      db.prepare(`
        INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json, sbt_minted)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.userId,
        summary.tier,
        summary.score,
        0,
        summary.score,
        JSON.stringify(summary),
        1
      );
    } catch (refreshError) {
      console.error('Failed to refresh score after repayment:', refreshError);
    }

    res.json({
      txHash,
      amountRepaid: (Number(totalOwedStroops) / 10_000_000).toFixed(2),
      updatedScore: refreshedScore ? {
        score: refreshedScore.score,
        tier: refreshedScore.tier,
        tierLabel: refreshedScore.tierLabel,
        borrowLimit: refreshedScore.borrowLimit,
        pointsToNextTier: refreshedScore.pointsToNextTier,
      } : null,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/status', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare('SELECT stellar_pub FROM users WHERE id = ?').get(req.userId) as any;
  
  try {
    const loan = await queryContract(
      contractIds.lendingPool,
      'get_loan',
      [Address.fromString(user.stellar_pub).toScVal()]
    );

    const poolBalance = await queryContract(contractIds.lendingPool, 'get_pool_balance', []);

    if (!loan) {
      return res.json({ hasActiveLoan: false, loan: null, poolBalance: Number(poolBalance || 0) / 10_000_000 });
    }

    const latestLedger = await rpcServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;

    let status = 'active';
    if (loan.repaid) status = 'repaid';
    else if (loan.defaulted) status = 'defaulted';
    else if (currentLedger > loan.due_ledger) status = 'overdue';

    res.json({
      hasActiveLoan: !loan.repaid && !loan.defaulted,
      poolBalance: Number(poolBalance || 0) / 10_000_000,
      loan: {
        principal: (Number(loan.principal) / 10_000_000).toFixed(2),
        fee: (Number(loan.fee) / 10_000_000).toFixed(2),
        totalOwed: ((Number(loan.principal) + Number(loan.fee)) / 10_000_000).toFixed(2),
        dueLedger: loan.due_ledger,
        currentLedger: currentLedger,
        status: status
      }
    });
  } catch (error) {
    try {
      const poolBalance = await queryContract(contractIds.lendingPool, 'get_pool_balance', []);
      res.json({ hasActiveLoan: false, loan: null, poolBalance: Number(poolBalance || 0) / 10_000_000 });
    } catch {
      res.json({ hasActiveLoan: false, loan: null, poolBalance: 0 });
    }
  }
});

export default router;
