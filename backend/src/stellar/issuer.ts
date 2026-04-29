import {
  Address,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import {
  WalletMetrics,
  buildScorePayload,
  tierLabel,
} from '../scoring/engine';
import { contractIds, issuerKeypair, networkPassphrase, rpcServer } from './client';
import { pollTransaction } from './feebump';
import { queryContract } from './query';

async function invokeIssuerContract(functionName: string, args: xdr.ScVal[]) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const tx = new TransactionBuilder(issuerAccount, {
    fee: '1000',
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractIds.creditRegistry).toScAddress(),
            functionName,
            args,
          })
        ),
        auth: [],
      })
    )
    .setTimeout(180)
    .build();

  console.log(`Invoking ${functionName} on ${contractIds.creditRegistry}...`);
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(issuerKeypair);

  const response = await rpcServer.sendTransaction(prepared);
  if (response.status !== 'PENDING') {
    console.error(`Submission failed for ${functionName}:`, response);
    throw new Error(`Issuer transaction failed: ${JSON.stringify(response.errorResult ?? response)}`);
  }

  console.log(`Transaction ${functionName} submitted: ${response.hash}. Polling...`);
  await pollTransaction(response.hash);
  return response.hash;
}

export async function updateOnChainMetrics(walletAddress: string, metrics: WalletMetrics) {
  const wallet = Address.fromString(walletAddress).toScVal();

  const metricsTxHash = await invokeIssuerContract('update_metrics_raw', [
    wallet,
    nativeToScVal(metrics.txCount, { type: 'u32' }),
    nativeToScVal(metrics.repaymentCount, { type: 'u32' }),
    nativeToScVal(metrics.avgBalance, { type: 'u32' }),
    nativeToScVal(metrics.defaultCount, { type: 'u32' }),
  ]);

  const scoreTxHash = await invokeIssuerContract('update_score', [wallet]);
  return { metricsTxHash, scoreTxHash };
}

export async function queryCreditRegistry(functionName: string, args: xdr.ScVal[]) {
  return queryContract(contractIds.creditRegistry, functionName, args);
}

export async function getOnChainCreditSnapshot(walletAddress: string) {
  const wallet = Address.fromString(walletAddress).toScVal();
  const [score, tier, metrics] = await Promise.all([
    queryCreditRegistry('get_score', [wallet]),
    queryCreditRegistry('get_tier', [wallet]),
    queryCreditRegistry('get_metrics', [wallet]),
  ]);
  const tierLimit = await queryCreditRegistry('get_tier_limit', [nativeToScVal(Number(tier ?? 0), { type: 'u32' })]);

  return buildScorePayload(walletAddress, {
    score: Number(score ?? 0),
    tier: Number(tier ?? 0),
    tierLimit: BigInt(tierLimit ?? 0),
    metrics: {
      txCount: Number(metrics?.tx_count ?? 0),
      repaymentCount: Number(metrics?.repayment_count ?? 0),
      avgBalance: Number(metrics?.avg_balance ?? 0),
      defaultCount: Number(metrics?.default_count ?? 0),
    },
    source: 'onchain',
    tierLabel: tierLabel(Number(tier ?? 0)),
  });
}
