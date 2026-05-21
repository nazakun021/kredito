import { Router } from 'express';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import { toXlmAmount, toStroops } from '../scoring/engine';
import { buildUnsignedContractCall } from '../stellar/feebump';
import { queryContract } from '../stellar/query';
import { contractIds, rpcServer } from '../stellar/client';
import { config, LEDGERS_PER_DAY } from '../config';

const router = Router();

router.get(
  '/terms',
  asyncRoute(async (req, res) => {
    res.json([
      {
        id: '30d',
        label: '30 Days',
        ledgers: 30 * LEDGERS_PER_DAY,
        apyBps: 500, // 5%
        apyLabel: '5%',
        apy: 5,
      },
      {
        id: '60d',
        label: '60 Days',
        ledgers: 60 * LEDGERS_PER_DAY,
        apyBps: 800, // 8%
        apyLabel: '8%',
        apy: 8,
      },
    ]);
  }),
);

router.get(
  '/position',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const deposit = await queryContract<{
      amount: bigint;
      deposited_at: number;
      term_ledgers: number;
      apy_bps: number;
    } | null>(contractIds.lendingPool, 'get_time_deposit', [Address.fromString(wallet).toScVal()]);

    if (!deposit) {
      return res.json(null);
    }

    const latestLedger = await rpcServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;
    const maturityLedger = deposit.deposited_at + deposit.term_ledgers;
    const isMatured = currentLedger >= maturityLedger;

    const ledgersRemaining = Math.max(0, maturityLedger - currentLedger);
    const daysRemaining = Math.ceil(ledgersRemaining / LEDGERS_PER_DAY);
    const msPerLedger = 5000; // Assume 5s
    const maturesAt = new Date(Date.now() + ledgersRemaining * msPerLedger).toISOString();

    const estimatedReturn =
      (deposit.amount * BigInt(deposit.apy_bps) * BigInt(deposit.term_ledgers)) /
      (10000n * BigInt(365 * LEDGERS_PER_DAY));

    const penaltyStroops = deposit.amount / 100n; // 1% of principal

    return res.json({
      amount: toXlmAmount(deposit.amount),
      depositedAt: deposit.deposited_at,
      termLedgers: deposit.term_ledgers,
      apyBps: deposit.apy_bps,
      maturityLedger,
      currentLedger,
      isMatured,
      maturesAt,
      daysRemaining,
      estimatedReturn: toXlmAmount(estimatedReturn),
      canWithdraw: isMatured,
      earlyWithdrawalPenaltyXlm: toXlmAmount(penaltyStroops),
      progress: Math.min(
        100,
        Math.floor(((currentLedger - deposit.deposited_at) / deposit.term_ledgers) * 100),
      ),
    });
  }),
);

router.post(
  '/create',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const { amount, termLedgers, apyBps } = req.body;
    if (!amount || !termLedgers || !apyBps) {
      throw badRequest('Amount, termLedgers, and apyBps are required');
    }

    const wallet = req.wallet;
    const amountStroops = toStroops(Number(amount));

    const unsignedXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'time_deposit',
      [
        Address.fromString(wallet).toScVal(),
        nativeToScVal(amountStroops, { type: 'i128' }),
        nativeToScVal(Number(termLedgers), { type: 'u32' }),
        nativeToScVal(Number(apyBps), { type: 'u32' }),
      ],
    );

    return res.json({
      requiresSignature: true,
      unsignedXdr,
    });
  }),
);

router.post(
  '/withdraw',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;

    // Enforce KYC check before allowing time deposit withdrawal
    const kycVerified = await queryContract<boolean>(
      contractIds.creditRegistry,
      'get_kyc_verified',
      [Address.fromString(wallet).toScVal()],
    );
    if (!kycVerified) {
      throw badRequest('KYC verification required before withdrawing time deposits');
    }

    const unsignedXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'withdraw_time_deposit',
      [Address.fromString(wallet).toScVal()],
    );

    return res.json({
      requiresSignature: true,
      unsignedXdr,
    });
  }),
);

router.post(
  '/approve',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Invalid amount');
    }

    const wallet = req.wallet;
    const amountStroops = toStroops(amount);

    // Get current ledger for expiry
    const latestLedger = await rpcServer.getLatestLedger();
    const expirationLedger = latestLedger.sequence + config.approvalLedgerWindow;

    const unsignedXdr = await buildUnsignedContractCall(wallet, contractIds.xlmSac, 'approve', [
      Address.fromString(wallet).toScVal(), // from
      Address.fromString(contractIds.lendingPool).toScVal(), // spender
      nativeToScVal(amountStroops, { type: 'i128' }), // amount
      nativeToScVal(expirationLedger, { type: 'u32' }), // expiration_ledger
    ]);

    return res.json({
      requiresSignature: true,
      unsignedXdr,
    });
  }),
);

export default router;
