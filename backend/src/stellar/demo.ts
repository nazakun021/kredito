import { Address, Keypair, nativeToScVal, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { contractIds, issuerKeypair, networkPassphrase, rpcServer } from './client';

async function submit(tx: any) {
  const response = await rpcServer.sendTransaction(tx);

  if (response.status !== 'PENDING') {
    throw new Error(`Transaction failed: ${JSON.stringify(response.errorResult)}`);
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const txResponse = await rpcServer.getTransaction(response.hash);
    if (txResponse.status === 'SUCCESS') return response.hash;
    if (txResponse.status === 'FAILED') {
      throw new Error('Transaction failed on-chain');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Transaction timeout');
}

async function ensureFriendbotFunding(publicKey: string) {
  if (networkPassphrase !== 'Test SDF Network ; September 2015') {
    return;
  }

  try {
    await rpcServer.getAccount(publicKey);
  } catch {
    const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    if (!response.ok) {
      throw new Error('Friendbot funding failed');
    }
  }
}

async function mintDemoPhpC(publicKey: string, amount: bigint) {
  if (!contractIds.phpcToken) return;

  const issuerAccount = await rpcServer.getAccount(issuerKeypair.publicKey());
  const tx = new TransactionBuilder(issuerAccount, {
    fee: '1000',
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractIds.phpcToken).toScAddress(),
            functionName: 'mint',
            args: [
              Address.fromString(publicKey).toScVal(),
              nativeToScVal(amount, { type: 'i128' }),
            ],
          })
        ),
        auth: [],
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(issuerKeypair);
  await submit(tx);
}

export async function ensureDemoWalletReady(userKeypair: Keypair) {
  await ensureFriendbotFunding(userKeypair.publicKey());

  const demoMintAmount = BigInt(process.env.DEMO_PREFUND_STROOPS || '1000000000000');
  if (demoMintAmount > 0) {
    await mintDemoPhpC(userKeypair.publicKey(), demoMintAmount);
  }
}
