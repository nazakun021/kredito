import {
  Address,
  nativeToScVal,
  Operation,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { WalletMetrics } from '../scoring/engine';
import { contractIds, issuerKeypair, networkPassphrase, rpcServer } from './client';

async function submit(tx: any) {
  const response = await rpcServer.sendTransaction(tx);

  if (response.status !== 'PENDING') {
    throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const txResponse = await rpcServer.getTransaction(response.hash);
    if (txResponse.status === 'SUCCESS') {
      return response.hash;
    }
    if (txResponse.status === 'FAILED') {
      throw new Error('Transaction failed on-chain');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Transaction timeout');
}

export async function invokeIssuerContract(functionName: string, args: xdr.ScVal[]) {
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
    .setTimeout(30)
    .build();

  tx.sign(issuerKeypair);
  return submit(tx);
}

export async function updateOnChainMetrics(walletAddress: string, metrics: WalletMetrics) {
  return invokeIssuerContract('update_metrics_raw', [
    Address.fromString(walletAddress).toScVal(),
    nativeToScVal(metrics.txCount, { type: 'u32' }),
    nativeToScVal(metrics.repaymentCount, { type: 'u32' }),
    nativeToScVal(metrics.avgBalance, { type: 'u32' }),
    nativeToScVal(metrics.defaultCount, { type: 'u32' }),
  ]);
}

export async function queryCreditRegistry(functionName: string, args: xdr.ScVal[]) {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const tx = new TransactionBuilder(issuerAccount, {
    fee: '100',
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
    .build();

  const response = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(response)) {
    throw new Error(`Simulation failed: ${JSON.stringify(response)}`);
  }

  return scValToNative(response.result!.retval);
}

export async function getOnChainCreditSnapshot(walletAddress: string) {
  const wallet = Address.fromString(walletAddress).toScVal();
  const [score, tier, metrics] = await Promise.all([
    queryCreditRegistry('get_score', [wallet]),
    queryCreditRegistry('get_tier', [wallet]),
    queryCreditRegistry('get_metrics', [wallet]),
  ]);

  return { score, tier, metrics };
}
