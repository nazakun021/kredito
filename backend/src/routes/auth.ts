import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair, StrKey, WebAuth } from '@stellar/stellar-sdk';
import { z } from 'zod';
import { config } from '../config';
import { asyncRoute, badRequest, unauthorized } from '../errors';

const router = Router();
const webAuthKeypair = Keypair.fromSecret(config.webAuthSecretKey);
const CHALLENGE_TIMEOUT_SECONDS = 5 * 60;

const freighterChallengeSchema = z.object({
  wallet: z.string().startsWith('G'),
});

const freighterLoginSchema = z.object({
  signedChallenge: z.string().min(1),
});

function issueToken(wallet: string) {
  return jwt.sign({ sub: wallet }, config.jwtSecret, { expiresIn: '1h' });
}

router.post(
  '/challenge',
  asyncRoute(async (req, res) => {
    // Some frontend sends { stellarAddress: ... } or { wallet: ... }. Let's accept both for backwards compatibility
    const walletAddr = req.body.wallet || req.body.stellarAddress;
    const parsed = freighterChallengeSchema.safeParse({ wallet: walletAddr });

    if (!parsed.success) {
      throw badRequest('Invalid Stellar address');
    }

    if (!StrKey.isValidEd25519PublicKey(parsed.data.wallet)) {
      throw badRequest('Invalid Stellar address');
    }

    const challengeXdr = WebAuth.buildChallengeTx(
      webAuthKeypair,
      parsed.data.wallet,
      config.homeDomain,
      CHALLENGE_TIMEOUT_SECONDS,
      config.networkPassphrase,
      config.webAuthDomain,
    );

    res.json({
      challenge: challengeXdr,
      expiresAt: Math.floor(Date.now() / 1000) + CHALLENGE_TIMEOUT_SECONDS,
    });
  }),
);

router.post(
  '/login',
  asyncRoute(async (req, res) => {
    // Accepts { signedChallenge } or { signedChallengeXdr }
    const xdr = req.body.signedChallenge || req.body.signedChallengeXdr;
    const parsed = freighterLoginSchema.safeParse({ signedChallenge: xdr });
    if (!parsed.success) {
      throw badRequest('Missing signed challenge');
    }

    let clientAccountID: string;

    try {
      const details = WebAuth.readChallengeTx(
        parsed.data.signedChallenge,
        webAuthKeypair.publicKey(),
        config.networkPassphrase,
        config.homeDomain,
        config.webAuthDomain,
      );

      clientAccountID = details.clientAccountID;

      WebAuth.verifyChallengeTxSigners(
        parsed.data.signedChallenge,
        webAuthKeypair.publicKey(),
        config.networkPassphrase,
        [clientAccountID],
        config.homeDomain,
        config.webAuthDomain,
      );
    } catch {
      throw unauthorized('Wallet signature could not be verified or challenge expired');
    }

    const token = issueToken(clientAccountID);

    return res.json({
      token,
      wallet: clientAccountID,
    });
  }),
);

export default router;
