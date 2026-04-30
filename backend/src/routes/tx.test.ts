import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import txRoutes from './tx';
import { hasActiveLoan } from '../stellar/query';
import { submitSponsoredSignedXdr } from '../stellar/feebump';

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((req, res, next) => {
    req.wallet = 'GBORROWER';
    next();
  }),
}));

vi.mock('../stellar/query', () => ({
  hasActiveLoan: vi.fn(),
  getLoanFromChain: vi.fn(),
  waitForLoanRepayment: vi.fn(),
}));

vi.mock('../stellar/feebump', () => ({
  submitSponsoredSignedXdr: vi.fn(),
}));

vi.mock('../scoring/engine', () => ({
  buildScoreSummary: vi.fn(),
  toPhpAmount: vi.fn((v) => (Number(v) / 10_000_000).toFixed(2)),
}));

vi.mock('../stellar/issuer', () => ({
  getOnChainCreditSnapshot: vi.fn(),
  updateOnChainMetrics: vi.fn(),
}));

import { errorHandler } from '../errors';

const app = express();
app.use(express.json());
app.use('/tx', txRoutes);
app.use(errorHandler);

describe('TX Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /tx/sign-and-submit', () => {
    it('rejects borrow if an active loan already exists', async () => {
      vi.mocked(hasActiveLoan).mockResolvedValue(true);

      const response = await request(app)
        .post('/tx/sign-and-submit')
        .send({
          signedInnerXdr: 'AAAA...',
          flow: { action: 'borrow' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Active loan already exists');
      expect(submitSponsoredSignedXdr).not.toHaveBeenCalled();
    });

    it('allows borrow if no active loan exists', async () => {
      vi.mocked(hasActiveLoan).mockResolvedValue(false);
      vi.mocked(submitSponsoredSignedXdr).mockResolvedValue('TX_HASH');

      const response = await request(app)
        .post('/tx/sign-and-submit')
        .send({
          signedInnerXdr: 'AAAA...',
          flow: { action: 'borrow' },
        });

      expect(response.status).toBe(200);
      expect(response.body.txHash).toBe('TX_HASH');
      expect(submitSponsoredSignedXdr).toHaveBeenCalled();
    });
  });
});
