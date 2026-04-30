import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair, StrKey, TransactionBuilder, WebAuth } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { config } from '../config';
import db from '../db';
import { asyncRoute, badRequest, unauthorized } from '../errors';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import type { DbUser } from '../types/db';

const router = Router();
const webAuthKeypair = Keypair.fromSecret(config.webAuthSecretKey);
const CHALLENGE_TIMEOUT_SECONDS = 5 * 60;

const IS_PROD = process.env.NODE_ENV === "production";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "strict" as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 h in ms
  path: "/",
} as const;

const freighterChallengeSchema = z.object({
  stellarAddress: z.string().startsWith('G'),
});

const freighterLoginSchema = z.object({
  signedChallengeXdr: z.string().min(1),
});

function issueToken(userId: number) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '24h' });
}

function syntheticEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@kredito.local`;
}

function challengeHash(xdr: string) {
  const tx = TransactionBuilder.fromXDR(xdr, config.networkPassphrase);
  return Buffer.from(tx.hash()).toString('hex');
}

function consumeChallenge(stellarAddress: string, hash: string) {
  db.prepare(`DELETE FROM auth_challenges WHERE expires_at <= datetime('now')`).run();

  const deleted = db
    .prepare(
      `
      DELETE FROM auth_challenges
      WHERE stellar_pub = ?
        AND challenge_hash = ?
        AND expires_at > datetime('now')
      `,
    )
    .run(stellarAddress, hash);

  return deleted.changes > 0;
}

router.post(
  '/challenge',
  asyncRoute(async (req, res) => {
    const parsed = freighterChallengeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid Stellar address');
    }

    if (!StrKey.isValidEd25519PublicKey(parsed.data.stellarAddress)) {
      throw badRequest('Invalid Stellar address');
    }

    const challengeXdr = WebAuth.buildChallengeTx(
      webAuthKeypair,
      parsed.data.stellarAddress,
      config.homeDomain,
      CHALLENGE_TIMEOUT_SECONDS,
      config.networkPassphrase,
      config.webAuthDomain,
    );
    const hash = challengeHash(challengeXdr);

    db.prepare(`DELETE FROM auth_challenges WHERE stellar_pub = ?`).run(parsed.data.stellarAddress);
    db.prepare(
      `
      INSERT INTO auth_challenges (stellar_pub, challenge_hash, expires_at)
      VALUES (?, ?, datetime('now', '+5 minutes'))
      `,
    ).run(parsed.data.stellarAddress, hash);

    res.json({
      challengeXdr,
      expiresIn: CHALLENGE_TIMEOUT_SECONDS,
    });
  }),
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    const parsed = freighterLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Missing signed challenge');
    }

    let clientAccountID: string;
    let hash: string;

    try {
      const details = WebAuth.readChallengeTx(
        parsed.data.signedChallengeXdr,
        webAuthKeypair.publicKey(),
        config.networkPassphrase,
        config.homeDomain,
        config.webAuthDomain,
      );

      clientAccountID = details.clientAccountID;
      hash = Buffer.from(details.tx.hash()).toString('hex');
      WebAuth.verifyChallengeTxSigners(
        parsed.data.signedChallengeXdr,
        webAuthKeypair.publicKey(),
        config.networkPassphrase,
        [clientAccountID],
        config.homeDomain,
        config.webAuthDomain,
      );
    } catch {
      throw unauthorized('Wallet signature could not be verified');
    }

    if (!consumeChallenge(clientAccountID, hash)) {
      throw unauthorized('Wallet challenge expired. Please try again.');
    }

    const existing = db
      .prepare('SELECT id, stellar_pub, is_external FROM users WHERE stellar_pub = ?')
      .get(clientAccountID) as Pick<DbUser, 'id' | 'stellar_pub' | 'is_external'> | undefined;

    if (existing) {
      db.prepare(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        Number(existing.id),
      );
      return res
        .cookie("kredito_token", issueToken(Number(existing.id)), COOKIE_OPTIONS)
        .json({
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
      .run(syntheticEmail('freighter'), clientAccountID);

    db.prepare(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      Number(info.lastInsertRowid),
    );

    return res
      .cookie(
        "kredito_token",
        issueToken(Number(info.lastInsertRowid)),
        COOKIE_OPTIONS,
      )
      .json({
        wallet: clientAccountID,
        isNew: true,
        isExternal: true,
      });
  }),
);

router.post(
  '/refresh',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const userId = req.userId;
    if (typeof userId !== "number") throw unauthorized("User context missing");
    res
      .cookie("kredito_token", issueToken(userId), COOKIE_OPTIONS)
      .json({ ok: true });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie("kredito_token", { path: "/" }).json({ ok: true });
});

export default router;
