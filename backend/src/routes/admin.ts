import { Router } from 'express';
import pLimit from 'p-limit';
import { Address } from '@stellar/stellar-sdk';
import { asyncRoute, unauthorized } from '../errors';
import { config } from '../config';
import { getAllLoansFromChain, getLoanFromChain } from '../stellar/query';
import { buildAndSubmitFeeBump } from '../stellar/feebump';
import { issuerKeypair, contractIds } from '../stellar/client';

const router = Router();
const limit = pLimit(5);

router.get(
  '/check-defaults',
  asyncRoute(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${config.adminApiSecret}`) {
      throw unauthorized('Admin access only');
    }

    const { loans, latestLedger, oldestLedger } = await getAllLoansFromChain();
    req.log?.info({ scannedCount: loans.length, latestLedger }, 'Starting admin sweep');

    type SweepResult =
      | { wallet: string; status: 'defaulted' }
      | { wallet: string; status: 'skipped' }
      | { wallet: string; status: 'skipped_idempotent' }
      | { wallet: string; status: 'error'; error: string };

    const processLoan = async (loan: {
      walletAddress: string;
      due_ledger: number;
      defaulted: boolean;
      repaid: boolean;
    }): Promise<SweepResult> => {
      return limit(async () => {
        try {
          // 1. Pre-check: fetch latest state to avoid race conditions
          const latestLoan = await getLoanFromChain(loan.walletAddress);
          if (
            !latestLoan ||
            latestLoan.repaid ||
            latestLoan.defaulted ||
            latestLoan.due_ledger >= latestLedger
          ) {
            return { wallet: loan.walletAddress, status: 'skipped' };
          }

          // 2. Submit default transaction
          await buildAndSubmitFeeBump(issuerKeypair, contractIds.lendingPool, 'mark_default', [
            new Address(loan.walletAddress).toScVal(),
          ]);

          req.log?.info({ wallet: loan.walletAddress }, 'Loan marked as defaulted');
          return { wallet: loan.walletAddress, status: 'defaulted' };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          req.log?.error({ wallet: loan.walletAddress, message }, 'Caught error in processLoan');

          // 3. Idempotent check: ignore if already defaulted, repaid, or not overdue according to contract
          if (
            message.includes('LoanDefaulted') ||
            message.includes('LoanAlreadyRepaid') ||
            message.includes('LoanNotOverdue')
          ) {
            req.log?.warn(
              { wallet: loan.walletAddress, message },
              'Default execution skipped (idempotent)',
            );
            return { wallet: loan.walletAddress, status: 'skipped_idempotent' };
          }

          req.log?.error({ wallet: loan.walletAddress, err }, 'Failed to mark loan as defaulted');
          return { wallet: loan.walletAddress, status: 'error', error: message };
        }
      });
    };

    const results = await Promise.allSettled(loans.map(processLoan));

    const initialSummary = {
      defaulted: 0,
      skipped: 0,
      skipped_idempotent: 0,
      error: 0,
      errors: 0,
      defaultedWallets: [] as string[],
    };

    const summary = results.reduce((acc, res) => {
      if (res.status === 'rejected') {
        acc.errors += 1;
        return acc;
      }

      const { status, wallet } = res.value;
      switch (status) {
        case 'defaulted':
          acc.defaulted += 1;
          acc.defaultedWallets.push(wallet);
          break;
        case 'skipped':
          acc.skipped += 1;
          break;
        case 'skipped_idempotent':
          acc.skipped_idempotent += 1;
          break;
        case 'error':
          acc.error += 1;
          break;
      }
      return acc;
    }, initialSummary);

    res.json({
      ...summary,
      scannedBorrowers: loans.length,
      currentLedger: latestLedger,
      oldestIndexedLedger: oldestLedger,
    });
  }),
);

export default router;
