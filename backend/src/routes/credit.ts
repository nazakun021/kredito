import { Router } from 'express';
import { Address } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, notFound } from '../errors';
import { buildScoreSummary, getPoolSnapshot } from '../scoring/engine';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { queryContract } from '../stellar/query';
import { contractIds } from '../stellar/client';

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

    res.json(payload);
  }),
);

router.get(
  '/score',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    try {
      const payload = await getOnChainCreditSnapshot(req.wallet);
      if (payload.tier === 0 && payload.score === 0) {
        throw notFound('No score on-chain yet. Call generate first.');
      }

      res.json(payload);
    } catch (e) {
      if (e instanceof Error && e.message.includes('No score on-chain yet')) {
        throw e;
      }
      throw e;
    }
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
