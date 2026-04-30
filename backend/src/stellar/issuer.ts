import { Address, Operation, TransactionBuilder, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { WalletMetrics, buildScorePayload, tierLabel } from '../scoring/engine';
import { contractIds, issuerKeypair, networkPassphrase, rpcServer } from './client';
import { queryContract } from './query';
import { pollTransaction } from './feebump';

async function invokeIssuerContract(operations: { functionName: string; args: xdr.ScVal[] }[]) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const builder = new TransactionBuilder(issuerAccount, {
    fee: '1000',
    networkPassphrase,
  });

  for (const op of operations) {
    builder.addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractIds.creditRegistry).toScAddress(),
            functionName: op.functionName,
            args: op.args,
          }),
        ),
        auth: [],
      }),
    );
  }

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

  const hash = await invokeIssuerContract([
    {
      functionName: 'update_metrics_raw',
      args: [
        wallet,
        nativeToScVal(metrics.txCount, { type: 'u32' }),
        nativeToScVal(metrics.repaymentCount, { type: 'u32' }),
        nativeToScVal(metrics.avgBalance, { type: 'u32' }),
        nativeToScVal(metrics.defaultCount, { type: 'u32' }),
      ],
    },
    {
      functionName: 'update_score',
      args: [wallet],
    },
  ]);

  return { metricsTxHash: hash, scoreTxHash: hash };
}

export async function markLoanDefaulted(borrowerAddress: string) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const builder = new TransactionBuilder(issuerAccount, {
    fee: '1000',
    networkPassphrase,
  }).addOperation(
    Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeInvokeContract(
        new xdr.InvokeContractArgs({
          contractAddress: Address.fromString(contractIds.lendingPool).toScAddress(),
          functionName: 'mark_default',
          args: [Address.fromString(borrowerAddress).toScVal()],
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
      `Mark default transaction failed: ${JSON.stringify(response.errorResult ?? response)}`,
    );
  }

  await pollTransaction(response.hash);
  return response.hash;
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
  const tierLimit = await queryCreditRegistry('get_tier_limit', [
    nativeToScVal(Number(tier ?? 0), { type: 'u32' }),
  ]);

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
