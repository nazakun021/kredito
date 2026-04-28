import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import {
  buildScoreSummary,
  tierBorrowLimit,
  tierFeeBps,
  tierLabel,
} from '../scoring/engine';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { queryContract } from '../stellar/query';
import { contractIds } from '../stellar/client';

const router = Router();

async function buildResponse(userId: number, walletAddress: string) {
  const summary = await buildScoreSummary(walletAddress);
  let onChain = null;
  let metricsTxHash = null;

  try {
    metricsTxHash = await updateOnChainMetrics(walletAddress, summary.metrics);
    onChain = await getOnChainCreditSnapshot(walletAddress);
  } catch (error) {
    console.error('Unable to update on-chain metrics:', error);
  }

  const scorePayload = {
    score: onChain?.score ?? summary.score,
    tier: onChain?.tier ?? summary.tier,
    tierLabel: tierLabel(onChain?.tier ?? summary.tier),
    borrowLimit: tierBorrowLimit(onChain?.tier ?? summary.tier),
    feeBps: tierFeeBps(onChain?.tier ?? summary.tier),
    formula: summary.formula,
    metrics: onChain?.metrics
      ? {
          txCount: Number(onChain.metrics.tx_count ?? 0),
          repaymentCount: Number(onChain.metrics.repayment_count ?? 0),
          avgBalance: Number(onChain.metrics.avg_balance ?? 0),
          defaultCount: Number(onChain.metrics.default_count ?? 0),
        }
      : summary.metrics,
    factors: summary.factors,
    nextTier: summary.nextTier,
    pointsToNextTier: summary.pointsToNextTier,
    metricsTxHash,
  };

  db.prepare(`
    INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json, sbt_minted, sbt_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    scorePayload.tier,
    scorePayload.score,
    0,
    scorePayload.score,
    JSON.stringify(scorePayload),
    metricsTxHash ? 1 : 0,
    metricsTxHash
  );

  return scorePayload;
}

router.post('/generate', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, stellar_pub FROM users WHERE id = ?').get(req.userId) as any;
  const payload = await buildResponse(Number(user.id), user.stellar_pub);
  res.json(payload);
});

router.get('/score', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, stellar_pub FROM users WHERE id = ?').get(req.userId) as any;
  const latest = db
    .prepare('SELECT score_json FROM score_events WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(req.userId) as any;

  if (latest?.score_json) {
    return res.json(JSON.parse(latest.score_json));
  }

  const payload = await buildResponse(Number(user.id), user.stellar_pub);
  res.json(payload);
});

router.get('/pool', authMiddleware, async (_req: AuthRequest, res) => {
  const poolBalance = await queryContract(contractIds.lendingPool, 'get_pool_balance', []);
  res.json({ poolBalance: Number(poolBalance || 0) / 10_000_000 });
});

export default router;
