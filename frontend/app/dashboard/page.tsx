'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChartColumn,
  Coins,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface ScoreResponse {
  score: number;
  tier: number;
  tierLabel: string;
  borrowLimit: string;
  feeRate: number;
  feeBps: number;
  nextTier: string | null;
  nextTierThreshold: number | null;
  progressToNext: number;
  formula: {
    expression: string;
    txComponent: number;
    repaymentComponent: number;
    balanceComponent: number;
    defaultPenalty: number;
    total: number;
  };
  metrics: {
    txCount: number;
    repaymentCount: number;
    avgBalance: number;
    avgBalanceFactor: number;
    defaultCount: number;
  };
}

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: string;
  loan: null | {
    totalOwed: string;
    status: string;
  };
}

function tierGradient(tier: number) {
  switch (tier) {
    case 3:
      return 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)';
    case 2:
      return 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)';
    case 1:
      return 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)';
    default:
      return 'linear-gradient(135deg, #475569 0%, #64748B 100%)';
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const generateQuery = useQuery({
    queryKey: ['score-generate', user?.wallet],
    queryFn: () => api.post<ScoreResponse>('/credit/generate').then((res) => res.data),
    enabled: !!user,
    retry: 1,
  });

  const scoreQuery = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
    enabled: false,
  });

  const poolQuery = useQuery({
    queryKey: ['pool'],
    queryFn: () => api.get<{ poolBalance: string }>('/credit/pool').then((res) => res.data),
    enabled: !!user,
  });

  const loanStatusQuery = useQuery({
    queryKey: ['loan-status'],
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (generateQuery.data) {
      void scoreQuery.refetch();
    }
  }, [generateQuery.data, scoreQuery]);

  const refreshMutation = useMutation({
    mutationFn: () => api.post('credit/generate').then((res) => res.data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['score-generate'] });
      await queryClient.invalidateQueries({ queryKey: ['score'] });
      await queryClient.invalidateQueries({ queryKey: ['pool'] });
      await queryClient.invalidateQueries({ queryKey: ['loan-status'] });
    },
  });

  if (!user) return null;

  const score = scoreQuery.data ?? generateQuery.data;
  const loanStatus = loanStatusQuery.data;
  const isLoading = generateQuery.isLoading || (generateQuery.isSuccess && scoreQuery.isFetching && !scoreQuery.data);
  const nextTierProgress = score?.nextTierThreshold
    ? Math.max(0, Math.min(100, (score.score / score.nextTierThreshold) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Your Credit Passport overview
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <section
          className="lg:col-span-3 rounded-2xl p-6 animate-fade-up"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                Credit Passport
              </p>
              {isLoading ? (
                <div className="skeleton mt-3 h-14 w-28" />
              ) : (
                <h2 className="mt-3 text-6xl font-extrabold tabular-nums">{score?.score ?? '--'}</h2>
              )}
            </div>
            <div
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ background: tierGradient(score?.tier ?? 0), color: '#020617' }}
            >
              {score?.tierLabel ?? 'Unrated'}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Metric label="Borrow limit" value={`P${score?.borrowLimit ?? '0.00'}`} loading={isLoading} />
            <Metric label="Fee rate" value={`${(score?.feeRate ?? 0).toFixed(2)}%`} loading={isLoading} />
            <Metric label="Transactions" value={`${score?.metrics.txCount ?? 0}`} loading={isLoading} />
            <Metric label="Repayments" value={`${score?.metrics.repaymentCount ?? 0}`} loading={isLoading} />
          </div>

          <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(148, 163, 184, 0.06)' }}>
            <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <span>Progress to {score?.nextTier ?? 'Top tier'}</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {score?.nextTier ? `${score.progressToNext} pts` : 'Complete'}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-bg-elevated)' }}>
              <div className="h-2 rounded-full progress-animated" style={{ width: `${nextTierProgress}%`, background: tierGradient(score?.tier ?? 0) }} />
            </div>
          </div>

          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="btn-primary btn-dark mt-5"
          >
            <RefreshCw size={16} className={refreshMutation.isPending ? 'animate-spin' : ''} />
            {refreshMutation.isPending ? 'Refreshing on-chain score...' : 'Refresh On-Chain Score'}
          </button>
        </section>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <section className="card-elevated flex-1 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Pool status
                </p>
                <h2 className="mt-1 text-lg font-extrabold">P{poolQuery.data?.poolBalance ?? '0.00'}</h2>
              </div>
              <div
                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{
                  background: 'var(--color-accent-glow)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border-accent)',
                }}
              >
                {(score?.feeRate ?? 0).toFixed(2)}% fee
              </div>
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Funded by lenders, NGOs, and DAOs.
            </p>

            {loanStatus?.hasActiveLoan ? (
              <div className="mt-5">
                <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-bg-card)' }}>
                  Outstanding: <span className="font-bold">P{loanStatus.loan?.totalOwed ?? '0.00'}</span>
                </div>
                <button onClick={() => router.push('/loan/repay')} className="btn-primary btn-accent mt-4">
                  Repay Active Loan
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push('/loan/borrow')}
                disabled={!score || score.tier === 0}
                className="btn-primary btn-accent mt-5"
              >
                {score?.tier === 0 ? 'Keep transacting to improve your score' : `Borrow P${score?.borrowLimit ?? '0.00'}`}
                {score?.tier === 0 ? null : <ArrowRight size={16} />}
              </button>
            )}
          </section>

          <div className="grid grid-cols-2 gap-4 animate-fade-up">
            <InfoCard icon={Coins} title="Pool" value={`P${poolQuery.data?.poolBalance ?? '0.00'}`} isLoading={poolQuery.isLoading} />
            <InfoCard icon={Wallet} title="Wallet" value={`${user.wallet.slice(0, 4)}…${user.wallet.slice(-4)}`} isLoading={false} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card-elevated animate-fade-up">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-bg-elevated)' }}>
              <ChartColumn size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Score formula</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {score?.formula.expression}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-16" />
              ))}
            </div>
          ) : score ? (
            <div className="rounded-2xl p-4 font-mono text-sm leading-7" style={{ background: 'var(--color-bg-card)' }}>
              <p>score = ({score.metrics.txCount} x 2) = {score.formula.txComponent}</p>
              <p>      + ({score.metrics.repaymentCount} x 10) = {score.formula.repaymentComponent}</p>
              <p>      + ({score.metrics.avgBalanceFactor} x 5) = {score.formula.balanceComponent}</p>
              <p>      - ({score.metrics.defaultCount} x 25) = {score.formula.defaultPenalty}</p>
              <p>      -------------------------</p>
              <p className="font-bold">      = {score.formula.total}</p>
            </div>
          ) : null}
        </section>

        <section className="card-elevated animate-fade-up">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-bg-elevated)' }}>
              <TrendingUp size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Raw metrics</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Deterministic inputs read from Horizon and on-chain events.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-24" />)
              : [
                  { label: 'Avg balance', value: `${score?.metrics.avgBalance ?? 0}` },
                  { label: 'Balance factor', value: `${score?.metrics.avgBalanceFactor ?? 0}` },
                  { label: 'Defaults', value: `${score?.metrics.defaultCount ?? 0}` },
                  { label: 'Wallet', value: `${user.wallet.slice(0, 6)}...` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
                    <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-bold tabular-nums">{item.value}</p>
                  </div>
                ))}
          </div>

          {(generateQuery.isError || poolQuery.isError || loanStatusQuery.isError) ? (
            <button
              onClick={() => {
                void generateQuery.refetch();
                void scoreQuery.refetch();
                void poolQuery.refetch();
                void loanStatusQuery.refetch();
              }}
              className="btn-primary btn-dark mt-5"
            >
              Retry
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
      <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      {loading ? <div className="skeleton mt-3 h-7 w-20" /> : <p className="mt-2 text-lg font-bold tabular-nums">{value}</p>}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  isLoading,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  title: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <div className="card-elevated">
      <Icon size={16} style={{ color: 'var(--color-text-secondary)' }} />
      <p className="mt-3 text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </p>
      {isLoading ? <div className="skeleton mt-3 h-7 w-20" /> : <p className="mt-2 text-lg font-bold tabular-nums">{value}</p>}
    </div>
  );
}
