import { Router } from 'express';
import { asyncRoute, unauthorized } from '../errors';
import { config } from '../config';
import { getAllLoansFromChain } from '../stellar/query';
import { buildAndSubmitFeeBump } from '../stellar/feebump';
import { issuerKeypair, contractIds } from '../stellar/client';
import { Address } from '@stellar/stellar-sdk';

const router = Router();

router.get(
  '/check-defaults',
  asyncRoute(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${config.adminApiSecret}`) {
      throw unauthorized('Admin access only');
    }

    const defaulted: string[] = [];
    const errors: string[] = [];
    const { loans, latestLedger, oldestLedger, usedDevFallback } = await getAllLoansFromChain();

    for (const loan of loans) {
      try {
        if (!loan.defaulted && !loan.repaid && loan.due_ledger < latestLedger) {
          await buildAndSubmitFeeBump(issuerKeypair, contractIds.lendingPool, 'mark_default', [
            new Address(loan.walletAddress).toScVal(),
          ]);
          defaulted.push(loan.walletAddress);
        }
      } catch (err) {
        errors.push(
          `Failed for ${loan.walletAddress}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    res.json({
      defaulted,
      errors,
      scannedBorrowers: loans.length,
      currentLedger: latestLedger,
      oldestIndexedLedger: oldestLedger,
      usedDevFallback,
    });
  }),
);

export default router;
