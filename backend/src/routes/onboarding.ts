import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import * as emailOtp from '../services/emailOtp';
import { computeFullScore } from '../scoring/engine';
import { mintOrUpdateTier, getCurrentOnChainTier } from '../stellar/issuer';

const router = Router();

router.post('/send-otp', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = db.prepare('SELECT id, email, email_verified FROM users WHERE id = ?').get(req.userId) as any;
    if (user.email_verified) {
      return res.json({ alreadyVerified: true });
    }
    
    const { sent, expiresAt } = await emailOtp.sendOtp(user.id, user.email);
    res.json({
      sent,
      email: user.email.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + '*'.repeat(gp3.length)),
      expiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/verify-otp', authMiddleware, async (req: AuthRequest, res) => {
  const { otp } = req.body;
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Invalid code format' });
  }

  try {
    await emailOtp.verifyOtp(req.userId!, otp);
    res.json({ verified: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

const submitSchema = z.object({
  monthlyIncomeBand: z.enum(['<5k', '5k-10k', '10k-20k', '>20k']),
  monthlyExpenseBand: z.enum(['<5k', '5k-10k', '10k-20k', '>20k']),
  employmentType: z.enum(['self_employed', 'employed', 'irregular']),
  hasBusinessPermit: z.boolean(),
  hasBrgyCertificate: z.boolean(),
  hasCoopMembership: z.boolean(),
});

router.post('/submit', authMiddleware, async (req: AuthRequest, res) => {
  const result = submitSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  const user = db.prepare('SELECT id, email_verified, stellar_pub FROM users WHERE id = ?').get(req.userId) as any;
  if (!user.email_verified) {
    return res.status(403).json({ error: 'Complete email verification first' });
  }

  const data = result.data;
  const bootstrapScore = 0; // Will be computed inside computeFullScore or here

  db.prepare(`
    INSERT OR REPLACE INTO bootstrap_assessments 
    (user_id, email_verified, monthly_income_band, monthly_expense_band, employment_type, has_business_permit, has_brgy_certificate, has_coop_membership, bootstrap_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, 1, data.monthlyIncomeBand, data.monthlyExpenseBand, data.employmentType, data.hasBusinessPermit ? 1 : 0, data.hasBrgyCertificate ? 1 : 0, data.hasCoopMembership ? 1 : 0, 0);

  const fullScore = await computeFullScore(user.id, user.stellar_pub);
  
  // Update SBT if needed
  const currentOnChainTier = await getCurrentOnChainTier(user.stellar_pub);
  let sbtMinted = false;
  let sbtTxHash = null;

  if (fullScore.tier > currentOnChainTier) {
    sbtTxHash = await mintOrUpdateTier(user.stellar_pub, fullScore.tier);
    sbtMinted = true;
  }

  db.prepare(`
    INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json, sbt_minted, sbt_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, fullScore.tier, fullScore.totalScore, fullScore.bootstrapScore, fullScore.stellarScore, JSON.stringify(fullScore.breakdown), sbtMinted ? 1 : 0, sbtTxHash);

  res.json({
    ...fullScore,
    sbtMinted,
    sbtTxHash
  });
});

router.get('/status', authMiddleware, (req: AuthRequest, res) => {
  const assessment = db.prepare('SELECT id FROM bootstrap_assessments WHERE user_id = ?').get(req.userId);
  const user = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(req.userId) as any;
  
  res.json({
    hasCompletedBootstrap: !!assessment,
    emailVerified: !!user.email_verified,
  });
});

export default router;
