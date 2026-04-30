import cron from 'node-cron';
import db from './db';
import { rpcServer, contractIds } from './stellar/client';
import { buildScoreSummary } from './scoring/engine';
import { markLoanDefaulted, updateOnChainMetrics } from './stellar/issuer';
import { getLoanRecord } from './loan-state';
import type { ActiveLoanRow } from './types/db';
import { loadAllUserWallets } from './users';

async function reconcileActiveLoans() {
  console.log('Running Loan Reconciliation job...');
  const allWallets = loadAllUserWallets();

  for (const user of allWallets) {
    try {
      const loan = await getLoanRecord(user.stellar_pub);
      if (loan && !loan.repaid && !loan.defaulted) {
        db.prepare('INSERT OR IGNORE INTO active_loans (user_id, stellar_pub) VALUES (?, ?)').run(
          user.id,
          user.stellar_pub,
        );
      }
    } catch (error) {
      console.error(`Reconciliation error for ${user.stellar_pub}:`, error);
    }
  }
}

export function startCronJobs() {
  void reconcileActiveLoans();

  cron.schedule('0 */6 * * *', async () => {
    console.log('Running Default Monitor cron job...');

    const activeLoans = db.prepare('SELECT * FROM active_loans').all() as ActiveLoanRow[];

    for (const loanCache of activeLoans) {
      try {
        const loan = await getLoanRecord(loanCache.stellar_pub);

        if (!loan || loan.repaid || loan.defaulted) {
          // Clean up cache if loan is no longer active
          db.prepare('DELETE FROM active_loans WHERE id = ?').run(loanCache.id);
          continue;
        }

        const latestLedger = await rpcServer.getLatestLedger();
        if (latestLedger.sequence > loan.due_ledger) {
          console.log(
            `Loan for ${loanCache.stellar_pub} is overdue. Marking defaulted and refreshing score snapshot...`,
          );

          // Official mark on-chain
          await markLoanDefaulted(loanCache.stellar_pub);

          const refreshed = await buildScoreSummary(loanCache.stellar_pub);
          await updateOnChainMetrics(loanCache.stellar_pub, refreshed.metrics);

          db.prepare(
            `
            INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          ).run(
            loanCache.user_id,
            refreshed.tier,
            refreshed.score,
            0,
            refreshed.score,
            JSON.stringify({ reason: 'default', refreshed }),
          );

          db.prepare('DELETE FROM active_loans WHERE id = ?').run(loanCache.id);
        }
      } catch (error) {
        console.error(`Error processing loan for ${loanCache.stellar_pub}:`, error);
      }
    }
  });

  cron.schedule('0 */2 * * *', async () => {
    await reconcileActiveLoans();
  });
}
