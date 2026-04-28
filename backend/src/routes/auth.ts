import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';
import { z } from 'zod';
import db from '../db';
import { encrypt } from '../utils/crypto';
import { ensureDemoWalletReady } from '../stellar/demo';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret';
const DEMO_EMAIL = 'demo@kredito.local';

const loginSchema = z.object({
  email: z.string().email().optional(),
});

function issueToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

function serializeUser(user: any, isNew: boolean) {
  return {
    email: user.email,
    stellarAddress: user.stellar_pub,
    isNew,
  };
}

function findOrCreateUser(email: string) {
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  let isNew = false;
  let keypair: Keypair | null = null;

  if (!user) {
    keypair = Keypair.random();
    const encryptedSecret = encrypt(keypair.secret());

    const info = db.prepare(`
      INSERT INTO users (email, stellar_pub, stellar_enc_secret, email_verified)
      VALUES (?, ?, ?, 1)
    `).run(email, keypair.publicKey(), encryptedSecret);

    user = {
      id: info.lastInsertRowid,
      email,
      stellar_pub: keypair.publicKey(),
    };
    isNew = true;
  }

  return { user, isNew, keypair };
}

router.post('/demo', async (_req, res) => {
  const { user, isNew, keypair } = findOrCreateUser(DEMO_EMAIL);
  if (isNew && keypair) {
    try {
      await ensureDemoWalletReady(keypair);
    } catch (error) {
      console.error('Unable to prefund demo wallet:', error);
    }
  }
  res.json({
    token: issueToken(Number(user.id)),
    user: serializeUser(user, isNew),
  });
});

router.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const email = result.data.email || DEMO_EMAIL;
  const { user, isNew, keypair } = findOrCreateUser(email);
  if (isNew && keypair) {
    try {
      await ensureDemoWalletReady(keypair);
    } catch (error) {
      console.error('Unable to prefund wallet:', error);
    }
  }

  res.json({
    token: issueToken(Number(user.id)),
    user: serializeUser(user, isNew),
  });
});

export default router;
