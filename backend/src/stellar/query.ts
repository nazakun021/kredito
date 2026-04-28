import { 
  TransactionBuilder, 
  rpc, 
  xdr,
  Operation,
  Address,
  scValToNative
} from '@stellar/stellar-sdk';
import { rpcServer, networkPassphrase, issuerKeypair } from './client';

export async function queryContract(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[]
): Promise<any> {
  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  
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
          })
        ),
        auth: [],
      })
    )
    .build();

  const response = await rpcServer.simulateTransaction(tx);

  if (rpc.Api.isSimulationSuccess(response)) {
    return scValToNative(response.result.retval);
  }
  
  throw new Error(`Query failed: ${JSON.stringify(response)}`);
}
