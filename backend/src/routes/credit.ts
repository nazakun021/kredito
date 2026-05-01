import { Router } from 'express';
import { Address } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, notFound } from '../errors';
import { buildScoreSummary, getPoolSnapshot } from '../scoring/engine';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { queryContract } from '../stellar/query';
import { contractIds } from '../stellar/client';
import { logger } from '../utils/logger';

const router = Router();

router.post(
  '/generate',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const summary = await buildScoreSummary(req.wallet);
    const txHashes = await updateOnChainMetrics(req.wallet, summary.metrics);
    const payload = {
      ...summary,
      txHashes,
    };

    logger.info({ wallet: req.wallet, score: summary.score }, 'Generated new credit score');
    res.json(payload);
  }),
);

router.get(
  '/score',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const payload = await getOnChainCreditSnapshot(req.wallet);
    if (payload.tier === 0 && payload.score === 0) {
      throw notFound('No score on-chain yet. Call generate first.');
    }

    logger.info(
      { wallet: req.wallet, score: payload.score },
      'Retrieved on-chain credit snapshot',
    );
    res.json(payload);
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
    const metrics = await queryContract(contractIds.creditRegistry, 'get_metrics', [
      Address.fromString(req.wallet).toScVal(),
    ]);
    res.json(metrics);
  }),
);

export default router;
