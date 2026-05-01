import { Router } from 'express';
import pLimit from 'p-limit';
import { Address } from '@stellar/stellar-sdk';
import { asyncRoute } from '../errors';
import { getAllLoansFromChain, getLoanFromChain } from '../stellar/query';
import { buildAndSubmitFeeBump } from '../stellar/feebump';
import { issuerKeypair, contractIds } from '../stellar/client';
import { classifyError } from '../lib/errors/classifyError';
import { adminAuthMiddleware } from '../middleware/auth';

const router = Router();
const limit = pLimit(5);

router.get(
  '/check-defaults',
  adminAuthMiddleware,
  asyncRoute(async (req, res) => {
    const { loans, latestLedger, oldestLedger } = await getAllLoansFromChain();
    req.log?.info({ scannedCount: loans.length, latestLedger }, 'Starting admin sweep');

    type SweepResult =
      | { wallet: string; status: 'defaulted' }
      | { wallet: string; status: 'skipped' }
      | { wallet: string; status: 'skipped_idempotent' }
      | { wallet: string; status: 'error'; error: string };

    const overdueLoans = loans.filter(
      (l) => !l.repaid && !l.defaulted && l.due_ledger < latestLedger,
    );
    req.log?.info({ overdueCount: overdueLoans.length }, 'Filtered overdue loans');

    let failures = 0;
    const total = overdueLoans.length;
    // Safe: JS is single-threaded; pLimit callbacks interleave but never truly race.
    let breakerTriggered = false;

    const processLoan = async (loan: {
      walletAddress: string;
      due_ledger: number;
      defaulted: boolean;
      repaid: boolean;
    }): Promise<SweepResult> => {
      return limit(async () => {
        if (breakerTriggered) {
          req.log?.warn(
            { wallet: loan.walletAddress },
            'Default skipped: circuit breaker triggered',
          );
          return {
            wallet: loan.walletAddress,
            status: 'error',
            error: 'CIRCUIT_BREAKER_TRIGGERED',
          };
        }

        try {
          // 1. Final pre-check: fetch latest state to avoid race conditions (repaid between scan and now)
          const latestLoan = await getLoanFromChain(loan.walletAddress);

          if (!latestLoan || latestLoan.repaid || latestLoan.defaulted) {
            req.log?.warn(
              {
                wallet: loan.walletAddress,
                repaid: latestLoan?.repaid,
                defaulted: latestLoan?.defaulted,
                reason: 'loan_settled_or_modified',
              },
              'Default skipped',
            );
            return { wallet: loan.walletAddress, status: 'skipped' };
          }

          // Double check overdue status with latest data just in case
          if (latestLoan.due_ledger >= latestLedger) {
            req.log?.warn(
              {
                wallet: loan.walletAddress,
                due_ledger: latestLoan.due_ledger,
                latestLedger,
                reason: 'loan_not_yet_overdue',
              },
              'Default skipped',
            );
            return { wallet: loan.walletAddress, status: 'skipped' };
          }

          // 2. Submit default transaction
          req.log?.info({ wallet: loan.walletAddress }, 'Default attempt');
          await buildAndSubmitFeeBump(issuerKeypair, contractIds.lendingPool, 'mark_default', [
            new Address(loan.walletAddress).toScVal(),
          ]);

          req.log?.info({ wallet: loan.walletAddress }, 'Loan marked as defaulted');
          return { wallet: loan.walletAddress, status: 'defaulted' };
        } catch (err) {
          const action = classifyError(err);
          const message = err instanceof Error ? err.message : String(err);

          if (action === 'IGNORE') {
            req.log?.warn(
              { wallet: loan.walletAddress, message, reason: 'idempotent' },
              'Default skipped',
            );
            return { wallet: loan.walletAddress, status: 'skipped_idempotent' };
          }

          // Track failures for circuit breaker (RETRY and FAIL actions)
          failures++;
          if (total > 3 && failures / total > 0.3) {
            breakerTriggered = true;
          }

          if (action === 'RETRY') {
            req.log?.error(
              { wallet: loan.walletAddress, message, failures, total },
              'TX failed: retryable error (RPC/Timeout)',
            );
            throw err;
          }

          // action === 'FAIL'
          req.log?.error(
            { wallet: loan.walletAddress, err, failures, total },
            'TX failed: unexpected error',
          );
          return { wallet: loan.walletAddress, status: 'error', error: message };
        }
      });
    };

    const results = await Promise.allSettled(overdueLoans.map(processLoan));

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
