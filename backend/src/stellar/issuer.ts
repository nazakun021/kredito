import { Address, Operation, TransactionBuilder, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { WalletMetrics, buildScorePayload, tierLabel } from '../scoring/engine';
import { contractIds, issuerKeypair, networkPassphrase, rpcServer } from './client';
import { queryContract } from './query';
import { pollTransaction } from './feebump';

async function invokeIssuerContractSingle(functionName: string, args: xdr.ScVal[]) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const builder = new TransactionBuilder(issuerAccount, {
    fee: '1000',
    networkPassphrase,
  });

  builder.addOperation(
    Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(contractIds.creditRegistry).toScAddress(),
          functionName,
          args,
        }),
      ),
      auth: [],
    }),
  );

  const tx = builder.setTimeout(180).build();
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(issuerKeypair);

  const response = await rpcServer.sendTransaction(prepared);
  if (response.status !== 'PENDING') {
    throw new Error(
      `Issuer transaction failed: ${JSON.stringify(response.errorResult ?? response)}`,
    );
  }

  await pollTransaction(response.hash);
  return response.hash;
}

export async function updateOnChainMetrics(walletAddress: string, metrics: WalletMetrics) {
  const wallet = Address.fromString(walletAddress).toScVal();

  // Two sequential single-op transactions — Soroban does not allow multi-op txs
  const metricsTxHash = await invokeIssuerContractSingle('update_metrics_raw', [
    wallet,
    nativeToScVal(metrics.txCount, { type: 'u32' }),
    nativeToScVal(metrics.repaymentCount, { type: 'u32' }),
    nativeToScVal(metrics.xlmBalance, { type: 'u32' }),
    nativeToScVal(metrics.defaultCount, { type: 'u32' }),
  ]);

  const scoreTxHash = await invokeIssuerContractSingle('update_score', [wallet]);

  return { metricsTxHash, scoreTxHash };
}

export async function queryCreditRegistry<T = unknown>(functionName: string, args: xdr.ScVal[]) {
  return queryContract<T>(contractIds.creditRegistry, functionName, args);
}

export async function getOnChainCreditSnapshot(walletAddress: string) {
  const wallet = Address.fromString(walletAddress).toScVal();

  // P2-9: Run initial 4 queries in parallel to reduce sequential round-trips
  const [score, tier, metrics, tierLimitForTier0] = await Promise.all([
    queryCreditRegistry<bigint | number>('get_score', [wallet]),
    queryCreditRegistry<bigint | number>('get_tier', [wallet]),
    queryCreditRegistry<{
      tx_count?: number | bigint;
      repayment_count?: number | bigint;
      avg_balance?: number | bigint;
      default_count?: number | bigint;
    }>('get_metrics', [wallet]),
    queryCreditRegistry<bigint | number | string>('get_tier_limit', [
      nativeToScVal(0, { type: 'u32' }),
    ]),
  ]);

  // If tier is 0, we already have the limit. Otherwise fetch it.
  const finalTier = Number(tier ?? 0);
  const tierLimit =
    finalTier === 0
      ? tierLimitForTier0
      : await queryCreditRegistry<bigint | number | string>('get_tier_limit', [
          nativeToScVal(finalTier, { type: 'u32' }),
        ]);

  return buildScorePayload(walletAddress, {
    score: Number(score ?? 0),
    tier: finalTier,
    tierLimit: BigInt(tierLimit ?? 0),
    metrics: {
      txCount: Number(metrics?.tx_count ?? 0),
      repaymentCount: Number(metrics?.repayment_count ?? 0),
      xlmBalance: Number(metrics?.avg_balance ?? 0),
      defaultCount: Number(metrics?.default_count ?? 0),
    },
    source: 'onchain',
    tierLabel: tierLabel(finalTier),
  });
}
