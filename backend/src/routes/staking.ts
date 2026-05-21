import { Router } from 'express';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import { toXlmAmount, toStroops } from '../scoring/engine';
import { buildUnsignedContractCall } from '../stellar/feebump';
import { queryContract } from '../stellar/query';
import { contractIds, rpcServer } from '../stellar/client';
import { config } from '../config';

const router = Router();

router.get(
  '/info',
  asyncRoute(async (req, res) => {
    const [poolBalanceRaw, totalStakedRaw, totalRewardPoolRaw] = await Promise.all([
      queryContract<bigint>(contractIds.lendingPool, 'get_pool_balance', []),
      queryContract<bigint>(contractIds.lendingPool, 'get_total_staked_pub', []),
      queryContract<bigint>(contractIds.lendingPool, 'get_total_reward_pool_pub', []),
    ]);

    const totalRewardNum = Number(toXlmAmount(totalRewardPoolRaw ?? 0n));
    const totalStakedNum = Number(toXlmAmount(totalStakedRaw ?? 0n));
    // Annualized: assume current reward pool would be earned over 30 days
    const estimatedApy =
      totalStakedNum > 0
        ? Number(((totalRewardNum / totalStakedNum) * (365 / 30) * 100).toFixed(1))
        : 0.0;

    return res.json({
      poolBalance: toXlmAmount(poolBalanceRaw ?? 0n),
      totalStaked: toXlmAmount(totalStakedRaw ?? 0n),
      totalRewardPool: toXlmAmount(totalRewardPoolRaw ?? 0n),
      apy: estimatedApy,
    });
  }),
);

router.get(
  '/position',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const stakeInfo = await queryContract<{
      staked_amount: bigint;
      pending_rewards: bigint;
      share_bps: number;
    } | null>(contractIds.lendingPool, 'get_stake_info', [Address.fromString(wallet).toScVal()]);

    if (!stakeInfo) {
      return res.json({
        stakedAmount: '0.00',
        pendingRewards: '0.00',
        shareBps: 0,
      });
    }

    return res.json({
      stakedAmount: toXlmAmount(stakeInfo.staked_amount),
      pendingRewards: toXlmAmount(stakeInfo.pending_rewards),
      shareBps: stakeInfo.share_bps,
    });
  }),
);

router.post(
  '/stake',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Invalid amount');
    }

    const wallet = req.wallet;
    const amountStroops = toStroops(amount);

    const unsignedXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'stake',
      [
        Address.fromString(wallet).toScVal(),
        nativeToScVal(amountStroops, { type: 'i128' }),
      ],
    );

    return res.json({
      requiresSignature: true,
      unsignedXdr,
    });
  }),
);

router.post(
  '/unstake',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw badRequest('Invalid amount');
    }

    const wallet = req.wallet;
    const amountStroops = toStroops(amount);

    const unsignedXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.lendingPool,
      'unstake',
      [Address.fromString(wallet).toScVal(), nativeToScVal(amountStroops, { type: 'i128' })],
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

    const unsignedXdr = await buildUnsignedContractCall(
      wallet,
      contractIds.xlmSac,
      'approve',
      [
        Address.fromString(wallet).toScVal(), // from
        Address.fromString(contractIds.lendingPool).toScVal(), // spender
        nativeToScVal(amountStroops, { type: 'i128' }), // amount
        nativeToScVal(expirationLedger, { type: 'u32' }), // expiration_ledger
      ],
    );

    return res.json({
      requiresSignature: true,
      unsignedXdr,
    });
  }),
);

export default router;
