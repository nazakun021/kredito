import cron from 'node-cron';
import db from './db';
import { rpcServer, contractIds, issuerKeypair, networkPassphrase } from './stellar/client';
import { queryContract } from './stellar/query';
import { TransactionBuilder, Operation, xdr, Address } from '@stellar/stellar-sdk';
import { buildScoreSummary } from './scoring/engine';
import { updateOnChainMetrics } from './stellar/issuer';

export function startCronJobs() {
  // Run every 6 hours: 0 */6 * * *
  // For demo/testing, you might want it more frequent, but SPEC says 6 hours.
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
          console.log(`Loan for ${loanCache.stellar_pub} is overdue. Marking default...`);
          
          // 1. Mark Default on Lending Pool
          const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
          const markDefaultTx = new TransactionBuilder(issuerAccount, {
            fee: '1000',
            networkPassphrase,
          })
            .addOperation(
              Operation.invokeHostFunction({
                func: xdr.HostFunction.hostFunctionTypeInvokeContract(
                  new xdr.InvokeContractArgs({
                    contractAddress: Address.fromString(contractIds.lendingPool).toScAddress(),
                    functionName: 'mark_default',
                    args: [Address.fromString(loanCache.stellar_pub).toScVal()],
                  })
                ),
                auth: [],
              })
            )
            .setTimeout(30)
            .build();
          
          markDefaultTx.sign(issuerKeypair);
          await rpcServer.sendTransaction(markDefaultTx);

          // 2. Refresh on-chain score with the new default included in the metrics.
          const refreshed = await buildScoreSummary(loanCache.stellar_pub);
          await updateOnChainMetrics(loanCache.stellar_pub, refreshed.metrics);

          // 3. Log to score_events
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

          // 4. Remove from active_loans
          db.prepare('DELETE FROM active_loans WHERE id = ?').run(loanCache.id);
        }
      } catch (error) {
        console.error(`Error processing loan for ${loanCache.stellar_pub}:`, error);
      }
    }
  });
}
