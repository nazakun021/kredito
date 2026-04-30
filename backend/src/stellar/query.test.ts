import { describe, expect, it, vi } from 'vitest';
import {
  discoverBorrowersFromChain,
  getAllLoansFromChain,
  getLoanFromChain,
  hasActiveLoan,
  waitForLoanRepayment,
} from './query';
import { Keypair, xdr } from '@stellar/stellar-sdk';

const DUMMY_WALLET = 'GBCOYLF2WO33E7PH3F6COHDNWSO2VG5C4SUIYCYY26RV45UON7U73VYF';
const SECOND_WALLET = 'GDCMAY7XILWXKTJ7K5IJICJD2GFAKCIFPNGJB2HMNLUGIZUMVXT2VJRL';

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./client')>();
  const { xdr } = await import('@stellar/stellar-sdk');

  return {
    ...actual,
    rpcServer: {
      getAccount: vi
        .fn()
        .mockResolvedValue(
          new (await import('@stellar/stellar-sdk')).Account(
            (await import('@stellar/stellar-sdk')).Keypair.random().publicKey(),
            '1',
          ),
        ),
      simulateTransaction: vi.fn().mockResolvedValue({
        status: 'SUCCESS',
        result: {
          retval: xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('principal'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(5000000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('fee'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(250000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('due_ledger'),
              val: xdr.ScVal.scvU32(10000),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('repaid'),
              val: xdr.ScVal.scvBool(false),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('defaulted'),
              val: xdr.ScVal.scvBool(false),
            }),
          ]),
        },
      }),
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 12_345 }),
      getEvents: vi.fn().mockResolvedValue({
        oldestLedger: 10_000,
        latestLedger: 12_345,
        cursor: 'cursor-1',
        events: [
          {
            id: 'evt-1',
            type: 'contract',
            ledger: 12_000,
            ledgerClosedAt: new Date().toISOString(),
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            txHash: 'tx-1',
            topic: [
              xdr.ScVal.scvSymbol('disburse'),
              xdr.ScVal.scvString('GBCOYLF2WO33E7PH3F6COHDNWSO2VG5C4SUIYCYY26RV45UON7U73VYF'),
            ],
            value: xdr.ScVal.scvVoid(),
          },
          {
            id: 'evt-2',
            type: 'contract',
            ledger: 12_100,
            ledgerClosedAt: new Date().toISOString(),
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            txHash: 'tx-2',
            topic: [
              xdr.ScVal.scvSymbol('repaid'),
              xdr.ScVal.scvString('GDCMAY7XILWXKTJ7K5IJICJD2GFAKCIFPNGJB2HMNLUGIZUMVXT2VJRL'),
            ],
            value: xdr.ScVal.scvVoid(),
          },
        ],
      }),
    },
  };
});

vi.mock('@stellar/stellar-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Api: {
        ...actual.rpc.Api,
        isSimulationSuccess: vi.fn().mockReturnValue(true),
      },
    },
  };
});

describe('Stellar Query', () => {
  it('getLoanFromChain returns correct LoanState struct for active loan', async () => {
    const loan = await getLoanFromChain(DUMMY_WALLET);
    expect(loan).not.toBeNull();
    if (loan) {
      expect(loan.principal).toBe(5000000000n);
      expect(loan.fee).toBe(250000000n);
      expect(loan.repaid).toBe(false);
      expect(loan.defaulted).toBe(false);
    }
  });

  it('hasActiveLoan returns true for active loan', async () => {
    expect(await hasActiveLoan(DUMMY_WALLET)).toBe(true);
  });

  it('getLoanFromChain returns null for wallet with no loan', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');
    vi.mocked(rpcServer.simulateTransaction).mockResolvedValueOnce({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvVoid(),
      },
    } as any);

    const loan = await getLoanFromChain(Keypair.random().publicKey());
    expect(loan).toBeNull();
  });

  it('hasActiveLoan returns false after repaid loan', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');

    vi.mocked(rpcServer.simulateTransaction).mockResolvedValueOnce({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('repaid'),
            val: xdr.ScVal.scvBool(true),
          }),
        ]),
      },
    } as any);

    expect(await hasActiveLoan(DUMMY_WALLET)).toBe(false);
  });

  it('waitForLoanRepayment resolves once the loan is repaid', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');

    vi.mocked(rpcServer.simulateTransaction)
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        result: {
          retval: xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('repaid'),
              val: xdr.ScVal.scvBool(false),
            }),
          ]),
        },
      } as any)
      .mockResolvedValueOnce({
        status: 'SUCCESS',
        result: {
          retval: xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('principal'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(5000000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('fee'),
              val: xdr.ScVal.scvI128(
                new xdr.Int128Parts({
                  hi: new xdr.Int64(0),
                  lo: new xdr.Uint64(250000000),
                }),
              ),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('due_ledger'),
              val: xdr.ScVal.scvU32(10000),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('repaid'),
              val: xdr.ScVal.scvBool(true),
            }),
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol('defaulted'),
              val: xdr.ScVal.scvBool(false),
            }),
          ]),
        },
      } as any);

    const result = await waitForLoanRepayment(DUMMY_WALLET, 2, 0);
    expect(result.repaid).toBe(true);
  });

  it('waitForLoanRepayment throws after retries are exhausted', async () => {
    const { rpcServer } = await import('./client');
    const { xdr } = await import('@stellar/stellar-sdk');

    vi.mocked(rpcServer.simulateTransaction).mockResolvedValue({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('repaid'),
            val: xdr.ScVal.scvBool(false),
          }),
        ]),
      },
    } as any);

    await expect(waitForLoanRepayment(DUMMY_WALLET, 2, 0)).rejects.toThrow(
      'Repayment confirmation did not settle in time',
    );
  });

  it('discoverBorrowersFromChain derives wallets from lending pool events', async () => {
    const result = await discoverBorrowersFromChain();
    expect(result.borrowers).toEqual(expect.arrayContaining([DUMMY_WALLET, SECOND_WALLET]));
    expect(result.usedDevFallback).toBe(false);
    expect(result.oldestLedger).toBe(10_000);
    expect(result.latestLedger).toBe(12_345);
  });

  it('getAllLoansFromChain returns chain loans with borrower addresses', async () => {
    const { rpcServer } = await import('./client');

    vi.mocked(rpcServer.simulateTransaction).mockResolvedValue({
      status: 'SUCCESS',
      result: {
        retval: xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('principal'),
            val: xdr.ScVal.scvI128(
              new xdr.Int128Parts({
                hi: new xdr.Int64(0),
                lo: new xdr.Uint64(5000000000),
              }),
            ),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('fee'),
            val: xdr.ScVal.scvI128(
              new xdr.Int128Parts({
                hi: new xdr.Int64(0),
                lo: new xdr.Uint64(250000000),
              }),
            ),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('due_ledger'),
            val: xdr.ScVal.scvU32(10000),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('repaid'),
            val: xdr.ScVal.scvBool(false),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol('defaulted'),
            val: xdr.ScVal.scvBool(false),
          }),
        ]),
      },
    } as any);

    const result = await getAllLoansFromChain();
    expect(result.loans[0]).toMatchObject({
      walletAddress: DUMMY_WALLET,
      principal: 5000000000n,
      fee: 250000000n,
      repaid: false,
      defaulted: false,
    });
  });
});
