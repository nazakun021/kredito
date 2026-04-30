import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import { asyncRoute, badRequest } from '../errors';
import { buildScoreSummary, toPhpAmount } from '../scoring/engine';
import { submitSponsoredSignedXdr } from '../stellar/feebump';
import { updateOnChainMetrics } from '../stellar/issuer';
import { getLoanRecord, waitForLoanRepayment } from '../loan-state';
import { loadUserById } from '../users';

const router = Router();

const submitFlowSchema = z
  .object({
    action: z.enum(['borrow', 'repay']).optional(),
    step: z.string().optional(),
  })
  .optional();

function getExplorerUrl(txHash: string) {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

router.post(
  '/submit',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const payload = req.body?.signedXdr || req.body?.signedInnerXdr;
    const signedInnerXdr = Array.isArray(payload) ? payload : [payload];
    if (!signedInnerXdr.every((entry) => typeof entry === 'string' && entry.length > 0)) {
      throw badRequest('signedXdr is required');
    }

    const hashes: string[] = [];
    for (const xdr of signedInnerXdr) {
      hashes.push(await submitSponsoredSignedXdr(xdr));
    }

    const txHash = hashes[hashes.length - 1];
    res.json({
      txHash,
      txHashes: hashes,
      explorerUrl: getExplorerUrl(txHash),
    });
  }),
);

router.post(
  '/sign-and-submit',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const payload = req.body?.signedInnerXdr;
    const signedInnerXdr = Array.isArray(payload) ? payload : [payload];
    if (!signedInnerXdr.every((entry) => typeof entry === 'string' && entry.length > 0)) {
      throw badRequest('signedInnerXdr is required');
    }

    const flow = submitFlowSchema.parse(req.body?.flow);
    const user = loadUserById(req.userId);

    const hashes: string[] = [];
    for (const xdr of signedInnerXdr) {
      hashes.push(await submitSponsoredSignedXdr(xdr));
    }

    const txHash = hashes[hashes.length - 1];
    const responsePayload: Record<string, unknown> = {
      txHash,
      txHashes: hashes,
      explorerUrl: getExplorerUrl(txHash),
    };

    if (flow?.action === 'borrow') {
      db.prepare(
        `
        INSERT INTO active_loans (user_id, stellar_pub)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET stellar_pub = excluded.stellar_pub
        `,
      ).run(req.userId, user.stellar_pub);

      const loan = await getLoanRecord(user.stellar_pub);
      if (loan) {
        const principal = Number(toPhpAmount(loan.principal));
        const fee = Number(toPhpAmount(loan.fee));
        responsePayload.amount = principal.toFixed(2);
        responsePayload.fee = fee.toFixed(2);
        responsePayload.feeBps = principal > 0 ? Math.round((fee / principal) * 10_000) : 0;
        responsePayload.totalOwed = (principal + fee).toFixed(2);
      }
    }

    if (flow?.action === 'repay' && flow.step === 'repay') {
      const settledLoan = await waitForLoanRepayment(user.stellar_pub);
      const previousSnapshot = db
        .prepare('SELECT score_json FROM score_events WHERE user_id = ? ORDER BY id DESC LIMIT 1')
        .get(req.userId) as { score_json?: string } | undefined;
      const previousScore = previousSnapshot?.score_json
        ? ((JSON.parse(previousSnapshot.score_json).score as number | null | undefined) ?? null)
        : null;

      if (!settledLoan?.repaid) {
        throw badRequest('Repayment confirmation did not settle in time. Please retry.');
      }

      db.prepare('DELETE FROM active_loans WHERE user_id = ?').run(req.userId);

      const refreshed = await buildScoreSummary(user.stellar_pub);
      await updateOnChainMetrics(user.stellar_pub, refreshed.metrics);

      db.prepare(
        `
        INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json, sbt_minted)
        VALUES (?, ?, ?, 0, ?, ?, 1)
      `,
      ).run(
        req.userId,
        refreshed.tier,
        refreshed.score,
        refreshed.score,
        JSON.stringify(refreshed),
      );

      responsePayload.amountRepaid = toPhpAmount(
        settledLoan.principal + settledLoan.fee,
      );
      responsePayload.previousScore = previousScore;
      responsePayload.newScore = refreshed.score;
      responsePayload.newTier = refreshed.tierLabel;
      responsePayload.newBorrowLimit = refreshed.borrowLimit;
    }

    res.json(responsePayload);
  }),
);

export default router;
