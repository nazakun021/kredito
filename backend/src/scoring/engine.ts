// backend/src/scoring/engine.ts

import { Address, Horizon, scValToNative, xdr } from '@stellar/stellar-sdk';
import { LEDGERS_PER_DAY, STROOPS_PER_UNIT } from '../config';
import { contractIds, horizonServer, rpcServer } from '../stellar/client';
import { queryContract } from '../stellar/query';
import { paginateEvents } from '../stellar/events';

const REPAYMENT_LOOKBACK_LEDGERS = 10_000;

export interface WalletMetrics {
  txCount: number;
  repaymentCount: number;
  xlmBalance: number;
  defaultCount: number;
}

export interface HorizonMetrics {
  walletAgeDays: number;
  currentBalanceXlm: string;
  txCount: number;
  inboundPaymentCount: number;
  activitySpanDays: number;
  hasRegularActivity: boolean;
}

export interface ScoreFactor {
  key: string;
  label: string;
  value: number;
  weight: string;
  points: number;
}

export function calculateScore(
  metrics: WalletMetrics,
  horizon?: HorizonMetrics,
  kycVerified = false,
): number {
  const xlmBalanceFactor = Math.min(Math.floor((metrics.xlmBalance * 2) / 100), 10);
  let score =
    metrics.txCount * 1 +
    metrics.repaymentCount * 15 +
    xlmBalanceFactor * 5 -
    metrics.defaultCount * 30;

  if (horizon) {
    if (horizon.walletAgeDays > 365) score += 20;
    else if (horizon.walletAgeDays > 180) score += 10;

    if (horizon.inboundPaymentCount > 50) score += 15;
    if (horizon.hasRegularActivity) score += 10;
  }

  if (kycVerified) {
    score += 40;
  }

  return Math.max(0, score);
}

export function scoreToTier(score: number, kycVerified = false): 0 | 1 | 2 | 3 | 4 {
  if (kycVerified && score >= 200) return 4; // Platinum requires score >= 200 + KYC
  if (score >= 120) return 3;
  if (score >= 80) return 2;
  if (score >= 40) return 1;
  return 0;
}

export function tierLabel(tier: number) {
  switch (tier) {
    case 4:
      return 'Platinum';
    case 3:
      return 'Gold';
    case 2:
      return 'Silver';
    case 1:
      return 'Bronze';
    default:
      return 'Unrated';
  }
}

export function tierFeeBps(tier: number) {
  switch (tier) {
    case 4:
      return 50; // 0.5% fee for Platinum
    case 3:
      return 150;
    case 2:
      return 300;
    case 1:
      return 500;
    default:
      return 500;
  }
}

export function nextTier(score: number, kycVerified = false) {
  if (kycVerified) {
    if (score < 40) return { threshold: 40, label: 'Bronze' };
    if (score < 80) return { threshold: 80, label: 'Silver' };
    if (score < 120) return { threshold: 120, label: 'Gold' };
    if (score < 200) return { threshold: 200, label: 'Platinum' };
    return null;
  }

  if (score < 40) return { threshold: 40, label: 'Bronze' };
  if (score < 80) return { threshold: 80, label: 'Silver' };
  if (score < 120) return { threshold: 120, label: 'Gold' };
  if (score < 200) return { threshold: 200, label: 'Platinum (requires KYC)' };
  return null;
}

export function toXlmAmount(value: bigint | number) {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  const whole = amount / STROOPS_PER_UNIT;
  const fraction = amount % STROOPS_PER_UNIT;
  const minimumDisplayFraction = STROOPS_PER_UNIT / 100n;

  if (fraction === 0n || (whole === 0n && fraction < minimumDisplayFraction)) {
    return `${whole.toString()}.00`;
  }

  const trimmedFraction = fraction.toString().padStart(7, '0').replace(/0+$/, '');
  return `${whole.toString()}.${trimmedFraction.padEnd(2, '0')}`;
}

export function toXlmNumber(value: bigint | number) {
  return Number(toXlmAmount(value));
}

export function toStroops(amount: number) {
  return BigInt(Math.round(amount * 10_000_000));
}

export function buildScoreFactors(
  metrics: WalletMetrics,
  source: 'generated' | 'onchain' = 'generated',
  kycVerified = false,
): ScoreFactor[] {
  const xlmBalanceFactor =
    source === 'onchain'
      ? Math.min(Math.floor(metrics.xlmBalance / 100), 10)
      : Math.min(Math.floor((metrics.xlmBalance * 2) / 100), 10);

  const factors = [
    {
      key: 'txCount',
      label: 'Transaction count',
      value: metrics.txCount,
      weight: 'tx_count × 1',
      points: metrics.txCount * 1,
    },
    {
      key: 'repaymentCount',
      label: 'Repayments',
      value: metrics.repaymentCount,
      weight: 'repayment_count × 15',
      points: metrics.repaymentCount * 15,
    },
    {
      key: 'xlmBalanceFactor',
      label: 'XLM balance factor',
      value: xlmBalanceFactor,
      weight: 'xlm_balance_factor × 5',
      points: xlmBalanceFactor * 5,
    },
    {
      key: 'defaultCount',
      label: 'Defaults penalty',
      value: metrics.defaultCount,
      weight: 'default_count × -30',
      points: metrics.defaultCount * -30,
    },
  ];

  if (kycVerified) {
    factors.push({
      key: 'kycBonus',
      label: 'KYC Verification Bonus',
      value: 1,
      weight: 'kyc_verified × 40',
      points: 40,
    });
  }

  return factors;
}

export function buildScorePayload(
  walletAddress: string,
  input: {
    score: number;
    tier: number;
    tierLimit: bigint;
    metrics: WalletMetrics;
    horizonMetrics?: HorizonMetrics;
    kycVerified?: boolean;
    source: 'generated' | 'onchain';
    tierLabel?: string;
    txHashes?: { metricsTxHash?: string; scoreTxHash?: string };
  },
) {
  const xlmBalanceFactor =
    input.source === 'onchain'
      ? Math.min(Math.floor(input.metrics.xlmBalance / 100), 10)
      : Math.min(Math.floor((input.metrics.xlmBalance * 2) / 100), 10);

  const factors = buildScoreFactors(input.metrics, input.source, input.kycVerified);
  const upcomingTier = nextTier(input.score, input.kycVerified);

  let horizonBonus = 0;
  if (input.horizonMetrics) {
    if (input.horizonMetrics.walletAgeDays > 365) horizonBonus += 20;
    else if (input.horizonMetrics.walletAgeDays > 180) horizonBonus += 10;

    if (input.horizonMetrics.inboundPaymentCount > 50) horizonBonus += 15;
    if (input.horizonMetrics.hasRegularActivity) horizonBonus += 10;
  }

  return {
    walletAddress,
    source: input.source,
    score: input.score,
    tier: input.tier,
    tierNumeric: input.tier,
    tierLabel: input.tierLabel ?? tierLabel(input.tier),
    borrowLimit: toXlmAmount(input.tierLimit),
    borrowLimitRaw: input.tierLimit.toString(),
    feeRate: tierFeeBps(input.tier) / 100,
    feeBps: tierFeeBps(input.tier),
    progressToNext: upcomingTier ? Math.max(0, upcomingTier.threshold - input.score) : 0,
    nextTier: upcomingTier?.label ?? null,
    nextTierThreshold: upcomingTier?.threshold ?? null,
    kycVerified: !!input.kycVerified,
    horizonMetrics: input.horizonMetrics,
    metrics: {
      txCount: input.metrics.txCount,
      repaymentCount: input.metrics.repaymentCount,
      xlmBalance: input.metrics.xlmBalance,
      xlmBalanceFactor,
      defaultCount: input.metrics.defaultCount,
    },
    formula: {
      expression:
        'score = (tx_count × 1) + (repayment_count × 15) + (xlm_balance_factor × 5) - (default_count × 30) + (horizon_bonus) + (kyc_bonus)',
      txComponent: input.metrics.txCount * 1,
      repaymentComponent: input.metrics.repaymentCount * 15,
      balanceComponent: xlmBalanceFactor * 5,
      defaultPenalty: input.metrics.defaultCount * 30,
      horizonBonus: input.source === 'onchain' ? 0 : horizonBonus,
      kycBonus: input.kycVerified ? 40 : 0,
      total: input.score,
    },
    factors,
    txHashes: input.txHashes ?? {},
  };
}

export async function fetchHorizonMetrics(wallet: string): Promise<HorizonMetrics> {
  try {
    const account = await horizonServer.loadAccount(wallet);
    const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
    const currentBalanceXlm = Number(nativeBalance?.balance || 0);

    const firstTxPage = await horizonServer
      .transactions()
      .forAccount(wallet)
      .limit(1)
      .order('asc')
      .call();
    const firstTx = firstTxPage.records[0];
    const walletAgeDays = firstTx
      ? Math.floor((Date.now() - new Date(firstTx.created_at).getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    const payments = await horizonServer
      .payments()
      .forAccount(wallet)
      .limit(200)
      .order('desc')
      .call();

    const inboundPaymentCount = payments.records.filter((p: any) => p.to === wallet).length;

    // Use account sequence number as a proxy for total transactions
    // subtract a base if needed, but for scoring, a raw proxy is fine
    const totalTxCount = Number(BigInt(account.sequence) & 0xffffffffn);
    const txCount = Math.min(totalTxCount, 500);

    const activitySpanDays =
      payments.records.length > 1
        ? Math.floor(
            (new Date(payments.records[0].created_at).getTime() -
              new Date(payments.records[payments.records.length - 1].created_at).getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : 0;

    const hasRegularActivity = activitySpanDays > 30 && txCount > 10;

    return {
      walletAgeDays,
      currentBalanceXlm: currentBalanceXlm.toFixed(2),
      txCount,
      inboundPaymentCount,
      activitySpanDays,
      hasRegularActivity,
    };
  } catch {
    return {
      walletAgeDays: 0,
      currentBalanceXlm: '0.00',
      txCount: 0,
      inboundPaymentCount: 0,
      activitySpanDays: 0,
      hasRegularActivity: false,
    };
  }
}

export async function fetchTxCount(address: string): Promise<number> {
  try {
    let txCount = 0;
    let cursor = '';
    while (true) {
      const page = await horizonServer
        .transactions()
        .forAccount(address)
        .limit(200)
        .order('desc')
        .cursor(cursor)
        .call();

      txCount += page.records.length;

      if (page.records.length < 200 || txCount >= 1000) {
        break;
      }

      cursor = page.records[page.records.length - 1].paging_token;
    }
    return Math.min(txCount, 1000);
  } catch {
    return 0;
  }
}

/**
 * Returns the wallet's native XLM balance in whole units.
 */
export async function fetchXlmBalance(address: string): Promise<number> {
  try {
    const account = await horizonServer.accounts().accountId(address).call();
    const nativeBalance = account.balances.find(
      (balance): balance is Horizon.HorizonApi.BalanceLineNative => balance.asset_type === 'native',
    );
    return nativeBalance ? Math.max(0, Math.floor(Number(nativeBalance.balance))) : 0;
  } catch {
    return 0;
  }
}

export async function fetchRepaymentMetrics(
  address: string,
): Promise<Pick<WalletMetrics, 'repaymentCount' | 'defaultCount'>> {
  try {
    const latestLedger = await rpcServer.getLatestLedger();
    const requestedStartLedger = Math.max(0, latestLedger.sequence - REPAYMENT_LOOKBACK_LEDGERS);

    // P2-2: Use paginateEvents to ensure all events are fetched if > 200
    const { events } = await paginateEvents(
      [{ type: 'contract', contractIds: [contractIds.lendingPool] }],
      requestedStartLedger,
    );

    let repaymentCount = 0;
    let defaultCount = 0;

    for (const event of events) {
      const topicName = scValToNative(event.topic[0]);
      const topicAddress = event.topic[1] ? scValToNative(event.topic[1]) : null;
      if (topicAddress !== address) {
        continue;
      }

      if (topicName === 'repaid') repaymentCount += 1;
      if (topicName === 'defaulted') defaultCount += 1;
    }

    // ✅ NEW: Use credit_registry on-chain metrics as the authoritative floor.
    // This correctly recovers the full cumulative count even after RPC events expire,
    // replacing the old `get_loan.repaid` boolean fallback that capped count at 1.
    try {
      const onChain = await queryContract<{
        repayment_count?: number | bigint;
        default_count?: number | bigint;
      }>(contractIds.creditRegistry, 'get_metrics', [Address.fromString(address).toScVal()]);

      if (onChain) {
        repaymentCount = Math.max(repaymentCount, Number(onChain.repayment_count ?? 0));
        defaultCount = Math.max(defaultCount, Number(onChain.default_count ?? 0));
      }
    } catch {
      // Ignore registry errors — fall back to event-derived counts
    }

    return { repaymentCount, defaultCount };
  } catch {
    return { repaymentCount: 0, defaultCount: 0 };
  }
}

export async function buildWalletMetrics(address: string): Promise<WalletMetrics> {
  const [txCount, xlmBalance, repaymentData] = await Promise.all([
    fetchTxCount(address),
    fetchXlmBalance(address),
    fetchRepaymentMetrics(address),
  ]);

  return {
    txCount,
    xlmBalance,
    repaymentCount: repaymentData.repaymentCount,
    defaultCount: repaymentData.defaultCount,
  };
}

export async function getTierLimit(tier: number) {
  if (tier <= 0) {
    return 0n;
  }

  const result = await queryContract<bigint | number | string>(
    contractIds.creditRegistry,
    'get_tier_limit',
    [xdr.ScVal.scvU32(tier)],
  );
  return BigInt(result ?? 0);
}

export async function buildScoreSummary(address: string) {
  const [metrics, horizonMetrics, kycVerified] = await Promise.all([
    buildWalletMetrics(address),
    fetchHorizonMetrics(address),
    queryContract<boolean>(contractIds.creditRegistry, 'get_kyc_verified', [
      Address.fromString(address).toScVal(),
    ]),
  ]);

  const score = calculateScore(metrics, horizonMetrics, kycVerified);
  const tier = scoreToTier(score, kycVerified);
  const tierLimit = await getTierLimit(tier);

  return buildScorePayload(address, {
    score,
    tier,
    tierLimit,
    metrics,
    horizonMetrics,
    kycVerified,
    source: 'generated',
  });
}

export async function getPoolSnapshot() {
  const poolBalanceRaw = BigInt(
    (await queryContract<bigint | number | string>(
      contractIds.lendingPool,
      'get_pool_balance',
      [],
    )) ?? 0,
  );
  return {
    poolBalance: toXlmAmount(poolBalanceRaw),
    poolBalanceRaw: poolBalanceRaw.toString(),
  };
}

export function estimateDueDateFromLedgers(daysRemaining: number) {
  return new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString();
}

export function computeDaysRemaining(currentLedger: number, dueLedger: number) {
  return Math.floor((dueLedger - currentLedger) / LEDGERS_PER_DAY);
}
