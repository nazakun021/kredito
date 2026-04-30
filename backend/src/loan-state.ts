import { Address } from '@stellar/stellar-sdk';
import { queryContract } from './stellar/query';
import { contractIds } from './stellar/client';

interface LoanState {
  principal: bigint;
  fee: bigint;
  due_ledger: number;
  repaid: boolean;
  defaulted: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getLoanRecord(walletAddress: string): Promise<LoanState | null> {
  const loan = await queryContract(contractIds.lendingPool, 'get_loan', [
    Address.fromString(walletAddress).toScVal(),
  ]);

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

export async function waitForLoanRepayment(walletAddress: string, retries = 3, delayMs = 3000) {
  let lastLoan: LoanState | null = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    lastLoan = await getLoanRecord(walletAddress);
    if (lastLoan?.repaid) {
      return lastLoan;
    }

    if (attempt < retries - 1) {
      await sleep(delayMs);
    }
  }

  return lastLoan;
}
