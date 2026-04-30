import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import { buildScoreSummary, toPhpAmount } from '../scoring/engine';
import { submitSponsoredSignedXdr } from '../stellar/feebump';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { getLoanFromChain, waitForLoanRepayment } from '../stellar/query';

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
      const hash = await submitSponsoredSignedXdr(xdr);
      hashes.push(hash);
      req.log?.info({ txHash: hash }, 'Submitted sponsored transaction');
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
    const wallet = req.wallet;

    const hashes: string[] = [];
    for (const xdr of signedInnerXdr) {
      const hash = await submitSponsoredSignedXdr(xdr);
      hashes.push(hash);
      req.log?.info({ txHash: hash, action: flow?.action }, 'Submitted sponsored transaction');
    }

    const txHash = hashes[hashes.length - 1];
    const responsePayload: Record<string, unknown> = {
      txHash,
      txHashes: hashes,
      explorerUrl: getExplorerUrl(txHash),
    };

    if (flow?.action === 'borrow') {
      const loan = await getLoanFromChain(wallet);
      if (loan) {
        const principal = Number(toPhpAmount(loan.principal));
        const fee = Number(toPhpAmount(loan.fee));
        responsePayload.amount = principal.toFixed(2);
        responsePayload.fee = fee.toFixed(2);
        responsePayload.feeBps = principal > 0 ? Math.round((fee / principal) * 10_000) : 0;
        responsePayload.totalOwed = (principal + fee).toFixed(2);
      }
    }

    if (flow?.action === 'repay') {
      const settledLoan = await waitForLoanRepayment(wallet);
      req.log?.info({ wallet, txHash }, 'Repayment confirmed on-chain');
      const previousSnapshot = await getOnChainCreditSnapshot(wallet).catch(() => null);

      // Refresh score after repayment
      const refreshed = await buildScoreSummary(wallet);
      await updateOnChainMetrics(wallet, refreshed.metrics);

      responsePayload.amountRepaid = toPhpAmount(settledLoan.principal + settledLoan.fee);
      responsePayload.previousScore = previousSnapshot?.score ?? null;
      responsePayload.newScore = refreshed.score;
      responsePayload.newTier = refreshed.tierLabel;
      responsePayload.newTierNumeric = refreshed.tier;
      responsePayload.newBorrowLimit = refreshed.borrowLimit;
    }

    res.json(responsePayload);
  }),
);

export default router;
