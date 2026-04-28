import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import { computeFullScore } from '../scoring/engine';
import { mintOrUpdateTier, getCurrentOnChainTier } from '../stellar/issuer';

const router = Router();

router.get('/score', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, stellar_pub FROM users WHERE id = ?').get(req.userId) as any;
  
  const fullScore = await computeFullScore(user.id, user.stellar_pub);
  
  // Update SBT if needed
  const currentOnChainTier = await getCurrentOnChainTier(user.stellar_pub);
  let sbtMinted = false;
  let sbtTxHash = null;

  if (fullScore.tier > currentOnChainTier) {
    try {
      sbtTxHash = await mintOrUpdateTier(user.stellar_pub, fullScore.tier);
      sbtMinted = true;
    } catch (error) {
      console.error('SBT Minting error:', error);
    }
  }

  // Log score event
  db.prepare(`
    INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json, sbt_minted, sbt_tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, fullScore.tier, fullScore.totalScore, fullScore.bootstrapScore, fullScore.stellarScore, JSON.stringify(fullScore.breakdown), sbtMinted ? 1 : 0, sbtTxHash);

  res.json({
    tier: fullScore.tier,
    score: fullScore.totalScore,
    breakdown: fullScore.breakdown,
    tierLabel: fullScore.tier === 2 ? 'Trusted Credit' : (fullScore.tier === 1 ? 'Basic Credit' : 'Unscored'),
    borrowLimit: fullScore.tier === 2 ? '20,000.00' : (fullScore.tier === 1 ? '5,000.00' : '0.00'),
    sbtMinted,
    sbtTxHash
  });
});

export default router;
