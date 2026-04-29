import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { config } from '../config';
import db from '../db';
import { asyncRoute, badRequest } from '../errors';
import { encrypt } from '../utils/crypto';
import { ensureDemoWalletReady } from '../stellar/demo';

const router = Router();

const freighterLoginSchema = z.object({
  stellarAddress: z.string().startsWith('G'),
});

function issueToken(userId: number) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '24h' });
}

function syntheticEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@kredito.local`;
}

router.post(
  '/demo',
  asyncRoute(async (_req, res) => {
    const keypair = Keypair.random();
    const encryptedSecret = encrypt(keypair.secret());

    const info = db
      .prepare(
        `
        INSERT INTO users (email, stellar_pub, stellar_enc_secret, email_verified, is_external)
        VALUES (?, ?, ?, 1, 0)
      `,
      )
      .run(syntheticEmail('demo'), keypair.publicKey(), encryptedSecret);

    void ensureDemoWalletReady(keypair);

    res.json({
      token: issueToken(Number(info.lastInsertRowid)),
      wallet: keypair.publicKey(),
      isNew: true,
      isExternal: false,
    });
  }),
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const parsed = freighterLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid Stellar address');
    }

    const existing = db
      .prepare('SELECT id, stellar_pub, is_external FROM users WHERE stellar_pub = ?')
      .get(parsed.data.stellarAddress) as any;

    if (existing) {
      return res.json({
        token: issueToken(Number(existing.id)),
        wallet: existing.stellar_pub,
        isNew: false,
        isExternal: Boolean(existing.is_external),
      });
    }

    const info = db
      .prepare(
        `
        INSERT INTO users (email, stellar_pub, stellar_enc_secret, email_verified, is_external)
        VALUES (?, ?, NULL, 1, 1)
      `,
      )
      .run(syntheticEmail('freighter'), parsed.data.stellarAddress);

    res.json({
      token: issueToken(Number(info.lastInsertRowid)),
      wallet: parsed.data.stellarAddress,
      isNew: true,
      isExternal: true,
    });
  }),
);

export default router;
