// backend/src/stellar/query.ts

import {
  TransactionBuilder,
  rpc,
  xdr,
  Operation,
  Address,
  scValToNative,
} from '@stellar/stellar-sdk';
import { rpcServer, networkPassphrase, issuerKeypair, contractIds } from './client';
import pLimit from 'p-limit';
import { sleep } from '../utils/sleep';
import { paginateEvents } from './events';

export interface LoanState {
  principal: bigint;
  fee: bigint;
  due_ledger: number;
  repaid: boolean;
  defaulted: boolean;
}

export interface LoanRepaymentConfirmation {
  confirmed: boolean;
  loan: LoanState | null;
}

export interface LoanRecordWithBorrower extends LoanState {
  walletAddress: string;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(backoffMs * 2 ** i);
    }
  }
  throw new Error('unreachable');
}

async function getAllLendingPoolEvents() {
  const filters: rpc.Api.EventFilter[] = [
    {
      type: 'contract',
      contractIds: [contractIds.lendingPool],
    },
  ];

  const latestLedger = await withRetry(() => rpcServer.getLatestLedger());
  const requestedStartLedger = Math.max(0, latestLedger.sequence - 250_000); 

  const { events, oldestLedger } = await paginateEvents(filters, requestedStartLedger);

  return {
    events,
    latestLedger: latestLedger.sequence,
    oldestLedger,
  };
}

export async function discoverBorrowersFromChain(): Promise<{
  borrowers: string[];
  latestLedger: number;
  oldestLedger: number;
}> {
  const { events, latestLedger, oldestLedger } = await getAllLendingPoolEvents();
  const borrowers = new Set<string>();

  for (const event of events) {
    // P2-4: Filter by event topic[0] === 'disburse' to be precise
    const topicName = scValToNative(event.topic[0]);
    if (topicName !== 'disburse') continue;

    const borrower = event.topic[1] ? scValToNative(event.topic[1]) : null;
    if (typeof borrower === 'string' && borrower.startsWith('G')) {
      borrowers.add(borrower);
    }
  }

  return {
    borrowers: [...borrowers],
    latestLedger,
    oldestLedger,
  };
}

export async function queryContract<T = unknown>(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[],
): Promise<T> {
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
    return scValToNative(response.result!.retval) as T;
  }

  throw new Error(`Contract query failed for ${functionName}: ${JSON.stringify(response)}`);
}

export async function getLoanFromChain(walletAddress: string): Promise<LoanState | null> {
  const loan = await queryContract<{
    principal?: bigint;
    fee?: bigint;
    due_ledger?: number | bigint;
    repaid?: boolean;
    defaulted?: boolean;
  }>(contractIds.lendingPool, 'get_loan', [Address.fromString(walletAddress).toScVal()]);

  if (!loan) {
    return null;
  }

  return {
    principal: BigInt(loan.principal ?? 0),
    fee: BigInt(loan.fee ?? 0),
    due_ledger: Number(loan.due_ledger ?? 0),
    repaid: Boolean(loan.repaid),
    defaulted: Boolean(loan.defaulted),
  };
}

export async function getAllLoansFromChain(): Promise<{
  loans: LoanRecordWithBorrower[];
  latestLedger: number;
  oldestLedger: number;
}> {
  // TODO: This is O(N) and not scalable.
  // Replace with indexed event store or subgraph in production.
  const { borrowers, latestLedger, oldestLedger } = await discoverBorrowersFromChain();
  const limit = pLimit(5);
  const loans = await Promise.all(
    borrowers.map((walletAddress) =>
      limit(async () => {
        const loan = await getLoanFromChain(walletAddress);
        return loan ? { walletAddress, ...loan } : null;
      }),
    ),
  );

  return {
    loans: loans.filter((loan): loan is LoanRecordWithBorrower => loan !== null),
    latestLedger,
    oldestLedger,
  };
}

export async function waitForLoanRepayment(
  walletAddress: string,
  retries = 3,
  delayMs = 3000,
): Promise<LoanState> {
  let lastLoan: LoanState | null = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    lastLoan = await getLoanFromChain(walletAddress);
    if (lastLoan?.repaid) {
      return lastLoan;
    }

    if (attempt < retries - 1) {
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Repayment confirmation did not settle in time for wallet ${walletAddress} after ${retries} attempts.`,
  );
}

export async function hasActiveLoan(walletAddress: string): Promise<boolean> {
  const loan = await getLoanFromChain(walletAddress);
  return Boolean(loan && !loan.repaid && !loan.defaulted);
}
