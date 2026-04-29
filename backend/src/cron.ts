import cron from 'node-cron';
import db from './db';
import { Address } from '@stellar/stellar-sdk';
import { rpcServer, contractIds } from './stellar/client';
import { queryContract } from './stellar/query';
import { buildScoreSummary } from './scoring/engine';
import { updateOnChainMetrics } from './stellar/issuer';

export function startCronJobs() {
  cron.schedule('0 */6 * * *', async () => {
    console.log('Running Default Monitor cron job...');
    
    const activeLoans = db.prepare('SELECT * FROM active_loans').all() as any[];
    
    for (const loanCache of activeLoans) {
      try {
        const loan = await queryContract(
          contractIds.lendingPool,
          'get_loan',
          [Address.fromString(loanCache.stellar_pub).toScVal()]
        );

        if (!loan || loan.repaid || loan.defaulted) {
          // Clean up cache if loan is no longer active
          db.prepare('DELETE FROM active_loans WHERE id = ?').run(loanCache.id);
          continue;
        }

        const latestLedger = await rpcServer.getLatestLedger();
        if (latestLedger.sequence > loan.due_ledger) {
          console.log(`Loan for ${loanCache.stellar_pub} is overdue. Refreshing score snapshot...`);
          const refreshed = await buildScoreSummary(loanCache.stellar_pub);
          await updateOnChainMetrics(loanCache.stellar_pub, refreshed.metrics);

          db.prepare(`
            INSERT INTO score_events (user_id, tier, score, bootstrap_score, stellar_score, score_json)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            loanCache.user_id,
            refreshed.tier,
            refreshed.score,
            0,
            refreshed.score,
            JSON.stringify({ reason: 'default', refreshed })
          );

          db.prepare('DELETE FROM active_loans WHERE id = ?').run(loanCache.id);
        }
      } catch (error) {
        console.error(`Error processing loan for ${loanCache.stellar_pub}:`, error);
      }
    }
  });
}
