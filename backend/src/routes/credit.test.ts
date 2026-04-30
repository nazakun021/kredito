import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';

const getOnChainCreditSnapshot = vi.fn();

vi.mock('../middleware/auth', () => ({
  authMiddleware: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { wallet?: string }).wallet =
      'GDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUM';
    next();
  },
}));

vi.mock('../stellar/issuer', () => ({
  getOnChainCreditSnapshot,
  updateOnChainMetrics: vi.fn(),
}));

vi.mock('../scoring/engine', () => ({
  buildScoreSummary: vi.fn(),
  getPoolSnapshot: vi.fn(),
}));

vi.mock('../stellar/query', () => ({
  queryContract: vi.fn(),
}));

vi.mock('../stellar/client', () => ({
  contractIds: {
    creditRegistry: 'CREDIT',
  },
}));

describe('Credit Routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('propagates unexpected on-chain score failures instead of masking them as 404', async () => {
    getOnChainCreditSnapshot.mockRejectedValueOnce(new Error('RPC timeout'));

    const { default: creditRoutes } = await import('./credit');
    const scoreLayer = (creditRoutes as unknown as { stack: any[] }).stack.find(
      (layer) => layer.route?.path === '/score',
    );
    const routeHandler = scoreLayer.route.stack[1].handle as (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => void;

    const req = {
      wallet: 'GDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUMMYWALLETDUM',
    } as Request & { wallet: string };
    const res = {
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    routeHandler(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((next.mock.calls[0][0] as Error).message).toBe('RPC timeout');
  });
});
