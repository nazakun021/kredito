import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import { buildScoreSummary, toPhpAmount } from '../scoring/engine';
import { submitSponsoredSignedXdr } from '../stellar/feebump';
import { getOnChainCreditSnapshot, updateOnChainMetrics } from '../stellar/issuer';
import { getLoanFromChain, hasActiveLoan, waitForLoanRepayment } from '../stellar/query';

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
    if (
      signedInnerXdr.length === 0 ||
      !signedInnerXdr.every((entry) => typeof entry === 'string' && entry.length > 0)
    ) {
      throw badRequest('signedXdr/signedInnerXdr is required and must not be empty');
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
    if (
      signedInnerXdr.length === 0 ||
      !signedInnerXdr.every((entry) => typeof entry === 'string' && entry.length > 0)
    ) {
      throw badRequest('signedInnerXdr is required and must not be empty');
    }

    const flow = submitFlowSchema.parse(req.body?.flow);
    const wallet = req.wallet;

    const hashes: string[] = [];
    for (const xdr of signedInnerXdr) {
      if (flow?.action === 'borrow') {
        const active = await hasActiveLoan(wallet);
        if (active) {
          throw badRequest('Active loan already exists. Cannot borrow again.');
        }
      }

      const hash = await submitSponsoredSignedXdr(xdr);
      hashes.push(hash);
      req.log?.info(
        { txHash: hash, action: flow?.action, wallet },
        'Submitted sponsored transaction',
      );
    }

    type BaseTxResponse = {
      txHash: string;
      txHashes: string[];
      explorerUrl: string;
    };

    type BorrowResponse = BaseTxResponse & {
      amount: string;
      fee: string;
      feeBps: number;
      totalOwed: string;
    };

    type RepayResponse = BaseTxResponse & {
      amountRepaid: string;
      previousScore: number | null;
      newScore: number;
      newTier: string;
      newTierNumeric: number;
      newBorrowLimit: string;
    };

    const txHash = hashes[hashes.length - 1];
    const basePayload: BaseTxResponse = {
      txHash,
      txHashes: hashes,
      explorerUrl: getExplorerUrl(txHash),
    };

    if (flow?.action === 'borrow') {
      const loan = await getLoanFromChain(wallet);
      if (loan) {
        const principal = Number(toPhpAmount(loan.principal));
        const fee = Number(toPhpAmount(loan.fee));
        const borrowResponse: BorrowResponse = {
          ...basePayload,
          amount: principal.toFixed(2),
          fee: fee.toFixed(2),
          feeBps: principal > 0 ? Math.round((fee / principal) * 10_000) : 0,
          totalOwed: (principal + fee).toFixed(2),
        };
        return res.json(borrowResponse);
      }
    }

    if (flow?.action === 'repay') {
      const settledLoan = await waitForLoanRepayment(wallet);
      req.log?.info({ wallet, txHash }, 'Repayment confirmed on-chain');
      const previousSnapshot = await getOnChainCreditSnapshot(wallet).catch(() => null);

      // Refresh score after repayment
      const refreshed = await buildScoreSummary(wallet);
      await updateOnChainMetrics(wallet, refreshed.metrics);

      const repayResponse: RepayResponse = {
        ...basePayload,
        amountRepaid: toPhpAmount(settledLoan.principal + settledLoan.fee),
        previousScore: previousSnapshot?.score ?? null,
        newScore: refreshed.score,
        newTier: refreshed.tierLabel,
        newTierNumeric: refreshed.tier,
        newBorrowLimit: refreshed.borrowLimit,
      };
      return res.json(repayResponse);
    }

    res.json(basePayload);
  }),
);

export default router;
