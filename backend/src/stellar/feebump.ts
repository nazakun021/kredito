import {
  Address,
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Memo,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { horizonServer, issuerKeypair, networkPassphrase, rpcServer } from './client';

const CLASSIC_BASE_FEE = '100';
const SPONSORED_BASE_FEE = '1000000';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollTransaction(hash: string, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const txResponse = await rpcServer.getTransaction(hash);

      if (txResponse.status === 'SUCCESS') {
        return txResponse;
      }

      if (txResponse.status === 'FAILED') {
        throw new Error(
          `Transaction failed on-chain: ${JSON.stringify(txResponse.resultXdr ?? txResponse)}`,
        );
      }
    } catch (error) {
      // If it's a real failure from the contract, rethrow
      if (error instanceof Error && error.message.includes('Transaction failed on-chain')) {
        throw error;
      }
      // Otherwise, assume it's a transient RPC error and retry
      console.warn(
        `Polling attempt failed for ${hash}:`,
        error instanceof Error ? error.message : error,
      );
    }

    await sleep(1000);
  }

  throw new Error('Transaction timeout');
}

async function createAccountFromIssuer(destination: string) {
  const issuerAccount = await horizonServer.loadAccount(issuerKeypair.publicKey());
  const tx = new TransactionBuilder(issuerAccount, {
    fee: CLASSIC_BASE_FEE,
    networkPassphrase,
    memo: Memo.none(),
  })
    .addOperation(
      Operation.createAccount({
        destination,
        startingBalance: '10',
      }),
    )
    .setTimeout(180)
    .build();

  tx.sign(issuerKeypair);
  const response = await horizonServer.submitTransaction(tx);
  return response.hash;
}

async function ensureUserAccountByAddress(publicKey: string) {
  try {
    return await rpcServer.getAccount(publicKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('account not found')) {
      throw error;
    }

    await createAccountFromIssuer(publicKey);
    return rpcServer.getAccount(publicKey);
  }
}

async function ensureUserAccount(userKeypair: Keypair) {
  return ensureUserAccountByAddress(userKeypair.publicKey());
}

function buildInvokeTransaction(
  source: Horizon.AccountResponse | Awaited<ReturnType<typeof rpcServer.getAccount>>,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
) {
  return new TransactionBuilder(source, {
    fee: CLASSIC_BASE_FEE,
    networkPassphrase,
    memo: Memo.none(),
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          new xdr.InvokeContractArgs({
            contractAddress: Address.fromString(contractId).toScAddress(),
            functionName,
            args,
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(180)
    .build();
}

export async function buildUnsignedContractCall(
  userPublicKey: string,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
) {
  const sourceAccount = await ensureUserAccountByAddress(userPublicKey);
  const tx = buildInvokeTransaction(sourceAccount, contractId, functionName, args);
  const prepared = await rpcServer.prepareTransaction(tx);
  return prepared.toXDR();
}

export async function submitSponsoredSignedXdr(signedInnerXdr: string) {
  const innerTx = TransactionBuilder.fromXDR(signedInnerXdr, networkPassphrase) as Transaction;
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    issuerKeypair,
    SPONSORED_BASE_FEE,
    innerTx,
    networkPassphrase,
  );

  feeBump.sign(issuerKeypair);

  const response = await rpcServer.sendTransaction(feeBump);
  if (response.status !== 'PENDING') {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(response.errorResult ?? response)}`,
    );
  }

  await pollTransaction(response.hash);
  return response.hash;
}

export async function buildAndSubmitFeeBump(
  userKeypair: Keypair,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
): Promise<string> {
  const userAccount = await ensureUserAccount(userKeypair);
  const tx = buildInvokeTransaction(userAccount, contractId, functionName, args);
  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(userKeypair);

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    issuerKeypair,
    SPONSORED_BASE_FEE,
    prepared,
    networkPassphrase,
  );

  feeBump.sign(issuerKeypair);
  const response = await rpcServer.sendTransaction(feeBump as FeeBumpTransaction);

  if (response.status !== 'PENDING') {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(response.errorResult ?? response)}`,
    );
  }

  await pollTransaction(response.hash);
  return response.hash;
}
