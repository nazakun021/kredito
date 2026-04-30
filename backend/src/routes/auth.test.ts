import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from './auth';
import { Keypair } from '@stellar/stellar-sdk';

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    WebAuth: {
      buildChallengeTx: vi.fn().mockReturnValue('mocked-challenge-xdr'),
      readChallengeTx: vi.fn().mockReturnValue({ clientAccountID: 'G123' }),
      verifyChallengeTxSigners: vi.fn().mockReturnValue(true),
    },
  };
});

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  it('POST /api/auth/challenge - returns { challenge } with no DB call', async () => {
    const res = await request(app)
      .post('/api/auth/challenge')
      .send({ wallet: Keypair.random().publicKey() });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('challenge');
    expect(res.body).toHaveProperty('expiresAt');
  });

  it('POST /api/auth/login with valid challenge should return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ signedChallenge: 'valid-mock-xdr' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('wallet', 'G123');
  });

  it('POST /api/auth/login with invalid signature - returns 401', async () => {
    const { WebAuth } = await import('@stellar/stellar-sdk');
    vi.mocked(WebAuth.verifyChallengeTxSigners).mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app).post('/api/auth/login').send({ signedChallenge: 'invalid-xdr' });
    expect(res.status).toBe(401);
  });
});
