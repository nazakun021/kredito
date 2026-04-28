import { 
  TransactionBuilder, 
  rpc, 
  xdr,
  Operation,
  Address,
  nativeToScVal,
  scValToNative
} from '@stellar/stellar-sdk';
import { rpcServer, networkPassphrase, issuerKeypair, contractIds } from './client';

export async function getCurrentOnChainTier(walletAddress: string): Promise<number> {
  try {
    const response = await rpcServer.simulateTransaction(
      new TransactionBuilder(await rpcServer.getAccount(issuerKeypair.publicKey()), {
        fee: '100',
        networkPassphrase,
      })
        .addOperation(
          Operation.invokeHostFunction({
            func: xdr.HostFunction.hostFunctionTypeInvokeContract(
              new xdr.InvokeContractArgs({
                contractAddress: Address.fromString(contractIds.creditRegistry).toScAddress(),
                functionName: 'get_tier',
                args: [Address.fromString(walletAddress).toScVal()],
              })
            ),
            auth: [],
          })
        )
        .build()
    );

    if (response.result) {
      return scValToNative(response.result.retval);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

export async function mintOrUpdateTier(walletAddress: string, tier: number): Promise<string> {
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
            functionName: 'set_tier',
            args: [
              Address.fromString(walletAddress).toScVal(),
              nativeToScVal(tier, { type: 'u32' }),
            ],
          })
        ),
        auth: [],
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(issuerKeypair);

  const response = await rpcServer.sendTransaction(tx);
  if (response.status !== 'PENDING') {
    throw new Error(`SBT Mint failed: ${JSON.stringify(response.errorResult)}`);
  }

  // Poll for result
  let txHash = response.hash;
  for (let i = 0; i < 30; i++) {
    const txResponse = await rpcServer.getTransaction(txHash);
    if (txResponse.status === 'SUCCESS') {
      return txHash;
    } else if (txResponse.status === 'FAILED') {
      throw new Error('SBT Mint failed on-chain');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('SBT Mint timeout');
}
