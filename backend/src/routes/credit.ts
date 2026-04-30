// backend/src/routes/credit.ts

import { Router } from 'express';
import { Address } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import { asyncRoute, notFound } from '../errors';
import { buildScoreSummary, getPoolSnapshot } from '../scoring/engine';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { queryContract } from '../stellar/query';
import { contractIds } from '../stellar/client';
import { loadUserById } from '../users';

const router = Router();

router.post(
  '/generate',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const user = loadUserById(req.userId);
    const summary = await buildScoreSummary(user.stellar_pub);
    const txHashes = await updateOnChainMetrics(user.stellar_pub, summary.metrics);
    const payload = {
      ...summary,
      txHashes,
    };

    db.prepare(
      `
      INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json, sbt_minted, sbt_tx_hash)
      VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    `,
    ).run(
      user.id,
      payload.tier,
      payload.score,
      payload.score,
      JSON.stringify(payload),
      txHashes.metricsTxHash ? 1 : 0,
      txHashes.metricsTxHash ?? null,
    );

    res.json(payload);
  }),
);

router.get(
  '/score',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const user = loadUserById(req.userId);
    const latest = db
      .prepare('SELECT score_json FROM score_events WHERE user_id = ? ORDER BY id DESC LIMIT 1')
      .get(req.userId) as { score_json?: string } | undefined;

    if (!latest?.score_json) {
      throw notFound('No score on-chain yet. Call generate first.');
    }

    const payload = await getOnChainCreditSnapshot(user.stellar_pub);
    res.json({
      ...JSON.parse(latest.score_json),
      ...payload,
      source: 'onchain',
    });
  }),
);

router.get(
  '/pool',
  authMiddleware,
  asyncRoute(async (_req: AuthRequest, res) => {
    res.json(await getPoolSnapshot());
  }),
);

router.get(
  '/metrics',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const user = loadUserById(req.userId);
    const metrics = await queryContract(contractIds.creditRegistry, 'get_metrics', [
      Address.fromString(user.stellar_pub).toScVal(),
    ]);
    res.json(metrics);
  }),
);

export default router;
