import { 
  TransactionBuilder, 
  Keypair, 
  FeeBumpTransaction, 
  rpc, 
  xdr,
  Operation,
  Address
} from '@stellar/stellar-sdk';
import { rpcServer, networkPassphrase, issuerKeypair } from './client';

export async function buildAndSubmitFeeBump(
  userKeypair: Keypair,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[]
): Promise<string> {
  const userAccount = await rpcServer.getLedgerEntries(
    xdr.LedgerKey.account(new xdr.LedgerKeyAccount({ accountId: userKeypair.xdrPublicKey() }))
  ).then(() => rpcServer.getAccount(userKeypair.publicKey()));

  const innerTx = new TransactionBuilder(userAccount, {
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
    .setTimeout(30)
    .build();

  innerTx.sign(userKeypair);

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    issuerKeypair,
    '1000000',
    innerTx,
    networkPassphrase
  );

  feeBump.sign(issuerKeypair);

  const response = await rpcServer.sendTransaction(feeBump);

  if (response.status !== 'PENDING') {
    throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);
  }

  // Poll for result
  let status = response.status;
  let txHash = response.hash;
  
  for (let i = 0; i < 30; i++) {
    const txResponse = await rpcServer.getTransaction(txHash);
    if (txResponse.status === 'SUCCESS') {
      return txHash;
    } else if (txResponse.status === 'FAILED') {
      throw new Error('Transaction failed on-chain');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Transaction timeout');
}
