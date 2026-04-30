// backend/src/scoring/engine.ts

import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';
import { LEDGERS_PER_DAY, STROOPS_PER_UNIT } from '../config';
import { contractIds, horizonServer, rpcServer } from '../stellar/client';
import { queryContract } from '../stellar/query';

const REPAYMENT_LOOKBACK_LEDGERS = 250_000;

export interface WalletMetrics {
  txCount: number;
  repaymentCount: number;
  avgBalance: number;
  defaultCount: number;
}

export interface ScoreFactor {
  key: string;
  label: string;
  value: number;
  weight: string;
  points: number;
}

export function calculateScore(metrics: WalletMetrics): number {
  const avgBalanceFactor = Math.min(Math.floor(metrics.avgBalance / 100), 10);
  return Math.max(
    0,
    metrics.txCount * 2 +
      metrics.repaymentCount * 10 +
      avgBalanceFactor * 5 -
      metrics.defaultCount * 25,
  );
}

export function scoreToTier(score: number): 0 | 1 | 2 | 3 {
  if (score >= 120) return 3;
  if (score >= 80) return 2;
  if (score >= 40) return 1;
  return 0;
}

export function tierLabel(tier: number) {
  switch (tier) {
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

export function nextTier(score: number) {
  if (score < 40) return { threshold: 40, label: 'Bronze' };
  if (score < 80) return { threshold: 80, label: 'Silver' };
  if (score < 120) return { threshold: 120, label: 'Gold' };
  return null;
}

export function toPhpAmount(value: bigint | number) {
  const amount = typeof value === 'bigint' ? value : BigInt(value);
  const whole = amount / STROOPS_PER_UNIT;
  const fraction = amount % STROOPS_PER_UNIT;
  return `${whole.toString()}.${fraction.toString().padStart(7, '0').replace(/0+$/, '').padEnd(2, '0')}`;
}

export function toPhpNumber(value: bigint | number) {
  return Number(toPhpAmount(value));
}

export function toStroops(amount: number) {
  return BigInt(Math.round(amount * 10_000_000));
}

export function buildScoreFactors(metrics: WalletMetrics): ScoreFactor[] {
  const avgBalanceFactor = Math.min(Math.floor(metrics.avgBalance / 100), 10);

  return [
    {
      key: 'txCount',
      label: 'Transaction count',
      value: metrics.txCount,
      weight: 'tx_count × 2',
      points: metrics.txCount * 2,
    },
    {
      key: 'repaymentCount',
      label: 'Repayments',
      value: metrics.repaymentCount,
      weight: 'repayment_count × 10',
      points: metrics.repaymentCount * 10,
    },
    {
      key: 'avgBalanceFactor',
      label: 'Average balance factor',
      value: avgBalanceFactor,
      weight: 'avg_balance_factor × 5',
      points: avgBalanceFactor * 5,
    },
    {
      key: 'defaultCount',
      label: 'Defaults penalty',
      value: metrics.defaultCount,
      weight: 'default_count × -25',
      points: metrics.defaultCount * -25,
    },
  ];
}

export function buildScorePayload(
  walletAddress: string,
  input: {
    score: number;
    tier: number;
    tierLimit: bigint;
    metrics: WalletMetrics;
    source: 'generated' | 'onchain';
    tierLabel?: string;
    txHashes?: { metricsTxHash?: string; scoreTxHash?: string };
  },
) {
  const avgBalanceFactor = Math.min(Math.floor(input.metrics.avgBalance / 100), 10);
  const factors = buildScoreFactors(input.metrics);
  const upcomingTier = nextTier(input.score);

  return {
    walletAddress,
    source: input.source,
    score: input.score,
    tier: input.tier,
    tierNumeric: input.tier,
    tierLabel: input.tierLabel ?? tierLabel(input.tier),
    borrowLimit: toPhpAmount(input.tierLimit),
    borrowLimitRaw: input.tierLimit.toString(),
    feeRate: tierFeeBps(input.tier) / 100,
    feeBps: tierFeeBps(input.tier),
    progressToNext: upcomingTier ? Math.max(0, upcomingTier.threshold - input.score) : 0,
    nextTier: upcomingTier?.label ?? null,
    nextTierThreshold: upcomingTier?.threshold ?? null,
    metrics: {
      txCount: input.metrics.txCount,
      repaymentCount: input.metrics.repaymentCount,
      avgBalance: input.metrics.avgBalance,
      avgBalanceFactor,
      defaultCount: input.metrics.defaultCount,
    },
    formula: {
      expression:
        'score = (tx_count × 2) + (repayment_count × 10) + (avg_balance_factor × 5) - (default_count × 25)',
      txComponent: input.metrics.txCount * 2,
      repaymentComponent: input.metrics.repaymentCount * 10,
      balanceComponent: avgBalanceFactor * 5,
      defaultPenalty: input.metrics.defaultCount * 25,
      total: input.score,
    },
    factors,
    txHashes: input.txHashes ?? {},
  };
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

export async function fetchAverageBalance(address: string): Promise<number> {
  try {
    const account = await horizonServer.accounts().accountId(address).call();
    const nativeBalance = account.balances.find((balance: any) => balance.asset_type === 'native');
    return nativeBalance ? Math.max(0, Math.floor(Number(nativeBalance.balance))) : 0;
  } catch {
    return 0;
  }
}

export async function fetchRepaymentMetrics(
  address: string,
): Promise<Pick<WalletMetrics, 'repaymentCount' | 'defaultCount'>> {
  async function loadEvents(startLedger: number) {
    return rpcServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractIds.lendingPool],
        },
      ],
      limit: 200,
    });
  }

  function parseLedgerRange(error: unknown) {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : '';
    const match = message.match(/ledger range:\s*(\d+)\s*-\s*(\d+)/i);
    if (!match) return null;

    return {
      min: Number(match[1]),
      max: Number(match[2]),
    };
  }

  try {
    const latestLedger = await rpcServer.getLatestLedger();
    const requestedStartLedger = Math.max(0, latestLedger.sequence - REPAYMENT_LOOKBACK_LEDGERS);
    let events;

    try {
      events = await loadEvents(requestedStartLedger);
    } catch (error) {
      const range = parseLedgerRange(error);
      if (!range) {
        throw error;
      }

      events = await loadEvents(Math.max(range.min, Math.min(requestedStartLedger, range.max)));
    }

    let repaymentCount = 0;
    let defaultCount = 0;

    for (const event of events.events) {
      const topicName = scValToNative(event.topic[0]);
      const topicAddress = event.topic[1] ? scValToNative(event.topic[1]) : null;
      if (topicAddress !== address) {
        continue;
      }

      if (topicName === 'repaid') repaymentCount += 1;
      if (topicName === 'defaulted') defaultCount += 1;
    }

    // RPC event retention is limited. If older events have rolled out of the
    // available window, at least reflect the current persisted loan outcome.
    if (repaymentCount === 0 || defaultCount === 0) {
      try {
        const latestLoan = await queryContract(contractIds.lendingPool, 'get_loan', [
          Address.fromString(address).toScVal(),
        ]);

        if (latestLoan?.repaid) repaymentCount = Math.max(repaymentCount, 1);
        if (latestLoan?.defaulted) defaultCount = Math.max(defaultCount, 1);
      } catch {
        // Ignore latest-loan fallback failures and return the event-derived counts.
      }
    }

    return { repaymentCount, defaultCount };
  } catch {
    return { repaymentCount: 0, defaultCount: 0 };
  }
}

export async function buildWalletMetrics(address: string): Promise<WalletMetrics> {
  const [txCount, avgBalance, repaymentData] = await Promise.all([
    fetchTxCount(address),
    fetchAverageBalance(address),
    fetchRepaymentMetrics(address),
  ]);

  return {
    txCount,
    avgBalance,
    repaymentCount: repaymentData.repaymentCount,
    defaultCount: repaymentData.defaultCount,
  };
}

export async function getTierLimit(tier: number) {
  if (tier <= 0) {
    return 0n;
  }

  const result = await queryContract(contractIds.creditRegistry, 'get_tier_limit', [
    xdr.ScVal.scvU32(tier),
  ]);
  return BigInt(result ?? 0);
}

export async function buildScoreSummary(address: string) {
  const metrics = await buildWalletMetrics(address);
  const score = calculateScore(metrics);
  const tier = scoreToTier(score);
  const tierLimit = await getTierLimit(tier);

  return buildScorePayload(address, {
    score,
    tier,
    tierLimit,
    metrics,
    source: 'generated',
  });
}

export async function getPoolSnapshot() {
  const poolBalanceRaw = BigInt(
    await queryContract(contractIds.lendingPool, 'get_pool_balance', []),
  );
  return {
    poolBalance: toPhpAmount(poolBalanceRaw),
    poolBalanceRaw: poolBalanceRaw.toString(),
  };
}

export function estimateDueDateFromLedgers(daysRemaining: number) {
  return new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString();
}

export function computeDaysRemaining(currentLedger: number, dueLedger: number) {
  return Math.floor((dueLedger - currentLedger) / LEDGERS_PER_DAY);
}
