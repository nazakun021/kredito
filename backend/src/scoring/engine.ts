import { scValToNative } from '@stellar/stellar-sdk';
import { horizonServer, rpcServer, contractIds } from '../stellar/client';

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
      metrics.defaultCount * 25
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

export function tierBorrowLimit(tier: number) {
  switch (tier) {
    case 3:
      return 50000;
    case 2:
      return 20000;
    case 1:
      return 5000;
    default:
      return 0;
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

export function buildScoreFactors(metrics: WalletMetrics): ScoreFactor[] {
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
      key: 'avgBalance',
      label: 'Average balance factor',
      value: Math.min(Math.floor(metrics.avgBalance / 100), 10),
      weight: 'avg_balance_factor × 5',
      points: Math.min(Math.floor(metrics.avgBalance / 100), 10) * 5,
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

export async function fetchTxCount(address: string): Promise<number> {
  try {
    const txs = await horizonServer.transactions().forAccount(address).limit(200).call();
    return txs.records.length;
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

export async function fetchRepaymentMetrics(address: string): Promise<Pick<WalletMetrics, 'repaymentCount' | 'defaultCount'>> {
  try {
    const latestLedger = await rpcServer.getLatestLedger();
    const startLedger = Math.max(0, latestLedger.sequence - 200_000);

    const events = await rpcServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractIds.lendingPool],
        },
      ],
    });

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

export async function buildScoreSummary(address: string) {
  const metrics = await buildWalletMetrics(address);
  const score = calculateScore(metrics);
  const tier = scoreToTier(score);
  const next = nextTier(score);

  return {
    metrics,
    score,
    tier,
    tierLabel: tierLabel(tier),
    borrowLimit: tierBorrowLimit(tier),
    feeBps: tierFeeBps(tier),
    factors: buildScoreFactors(metrics),
    formula: 'score = (tx_count × 2) + (repayment_count × 10) + (avg_balance_factor × 5) - (default_count × 25)',
    nextTier: next,
    pointsToNextTier: next ? Math.max(0, next.threshold - score) : 0,
  };
}
