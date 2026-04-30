// backend/src/stellar/query.ts

import {
  TransactionBuilder,
  rpc,
  xdr,
  Operation,
  Address,
  scValToNative,
} from '@stellar/stellar-sdk';
import { rpcServer, networkPassphrase, issuerKeypair } from './client';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  backoffMs = 1000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(backoffMs * 2 ** i);
    }
  }
  throw new Error("unreachable");
}

export async function queryContract(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
): Promise<any> {
  const issuerAccount = await withRetry(() => rpcServer.getAccount(issuerKeypair.publicKey()));

  const tx = new TransactionBuilder(issuerAccount, {
    fee: '100',
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractId).toScAddress(),
            functionName: functionName,
            args: args,
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(30)
    .build();

  const response = await withRetry(() => rpcServer.simulateTransaction(tx));

  if (rpc.Api.isSimulationSuccess(response)) {
    return scValToNative(response.result!.retval);
  }

  throw new Error(`Contract query failed for ${functionName}: ${JSON.stringify(response)}`);
}
