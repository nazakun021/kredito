import cron from 'node-cron';
import db from './db';
import { rpcServer, contractIds, issuerKeypair, networkPassphrase } from './stellar/client';
import { queryContract } from './stellar/query';
import { TransactionBuilder, Operation, xdr, Address } from '@stellar/stellar-sdk';

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

          // 2. Revoke Tier on Credit Registry
          // We wait a bit for the first tx to land or just send another one with updated seq
          const issuerAccountUpdated = await rpcServer.getAccount(issuerKeypair.publicKey());
          const revokeTierTx = new TransactionBuilder(issuerAccountUpdated, {
            fee: '1000',
            networkPassphrase,
          })
            .addOperation(
              Operation.invokeHostFunction({
                func: xdr.HostFunction.hostFunctionTypeInvokeContract(
                  new xdr.InvokeContractArgs({
                    contractAddress: Address.fromString(contractIds.creditRegistry).toScAddress(),
                    functionName: 'revoke_tier',
                    args: [Address.fromString(loanCache.stellar_pub).toScVal()],
                  })
                ),
                auth: [],
              })
            )
            .setTimeout(30)
            .build();
          
          revokeTierTx.sign(issuerKeypair);
          await rpcServer.sendTransaction(revokeTierTx);

          // 3. Log to score_events
          db.prepare(`
            INSERT INTO score_events (user_id, tier, score, score_json)
            VALUES (?, ?, ?, ?)
          `).run(loanCache.user_id, 0, 0, JSON.stringify({ reason: 'default' }));

          // 4. Remove from active_loans
          db.prepare('DELETE FROM active_loans WHERE id = ?').run(loanCache.id);
        }
      } catch (error) {
        console.error(`Error processing loan for ${loanCache.stellar_pub}:`, error);
      }
    }
  });
}
