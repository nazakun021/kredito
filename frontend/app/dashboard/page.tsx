// frontend/app/dashboard/page.tsx

'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChartColumn,
  Clock,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { tierGradient, tierLabel, tierContextPhrase } from '@/lib/tiers';
import { QUERY_KEYS } from '@/lib/queryKeys';

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

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  // 1. Primary: Get the latest cached score (fast)
  const scoreQuery = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // 2. Secondary: Generate a new score if none exists or user clicks refresh
  const generateMutation = useMutation({
    mutationFn: () => api.post<ScoreResponse>('/credit/generate').then((res) => res.data),
    onSuccess: async (data) => {
      queryClient.setQueryData(QUERY_KEYS.score(user?.wallet ?? ''), data);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus });
    },
  });

  // 3. Auto-trigger generate only if score is missing
  const mutate = generateMutation.mutate;
  useEffect(() => {
    if (
      scoreQuery.isError && 
      !generateMutation.isPending && 
      !generateMutation.data && 
      !generateMutation.isError
    ) {
      mutate();
    }
  }, [scoreQuery.isError, generateMutation.isPending, generateMutation.data, generateMutation.isError, mutate]);

  const poolQuery = useQuery({
    queryKey: QUERY_KEYS.pool,
    queryFn: () => api.get<{ poolBalance: string }>('/credit/pool').then((res) => res.data),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  const loanStatusQuery = useQuery({
    queryKey: QUERY_KEYS.loanStatus,
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: !!user,
    staleTime: 30 * 1000,
  });

  if (!user) return null;

  const score = scoreQuery.data ?? generateMutation.data;
  const loanStatus = loanStatusQuery.data;
  const isLoading = (scoreQuery.isLoading && !scoreQuery.data) || generateMutation.isPending;
  
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
          className="lg:col-span-3 rounded-2xl p-6 animate-fade-up relative overflow-hidden"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex items-center gap-6">
              <div className="relative flex items-center justify-center h-32 w-32">
                <ScoreArc score={score?.score ?? 0} isLoading={isLoading} />
                <div className="text-center">
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Score
                  </p>
                  {isLoading ? (
                    <div className="skeleton h-10 w-16 mx-auto" />
                  ) : (
                    <h2 
                      className="text-4xl font-extrabold tabular-nums"
                      aria-label={`Credit score: ${score?.score ?? "not available"}`}
                    >
                      {score?.score ?? '--'}
                    </h2>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Credit Status
                </p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  {score ? tierContextPhrase(score.score) : '--'}
                </p>
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg"
              style={{ background: tierGradient(score?.tier ?? 0), color: '#020617' }}
            >
              {score?.tierLabel ?? 'Unrated'}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 relative z-10">
            <Metric label="Borrow limit" value={`P${score?.borrowLimit ?? '0.00'}`} loading={isLoading} />
            <Metric label="Fee rate" value={`${(score?.feeRate ?? 0).toFixed(2)}%`} loading={isLoading} />
            <Metric label="Transactions" value={`${score?.metrics.txCount ?? 0}`} loading={isLoading} />
            <Metric label="Repayments" value={`${score?.metrics.repaymentCount ?? 0}`} loading={isLoading} />
          </div>

          <div className="mt-6 rounded-xl p-4 relative z-10" style={{ background: 'rgba(148, 163, 184, 0.06)' }}>
            <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <span>
                {score?.nextTier 
                  ? `You need ${score.progressToNext} more points to reach ${score.nextTier}` 
                  : 'You have reached the top tier'}
              </span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {score?.nextTier ? `${score.score} / ${score.nextTierThreshold}` : 'Max'}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-bg-elevated)' }}>
              <div 
                className="h-2 rounded-full progress-animated" 
                style={{ width: `${nextTierProgress}%`, background: tierGradient(score?.tier ?? 0) }} 
              />
            </div>
          </div>

          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-primary btn-dark mt-6 relative z-10"
          >
            <RefreshCw size={16} className={generateMutation.isPending ? 'animate-spin' : ''} />
            {generateMutation.isPending ? 'Refreshing on-chain score...' : 'Refresh On-Chain Score'}
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
                {score?.tier === 0 ? 'Tier too low to borrow' : `Borrow P${score?.borrowLimit ?? '0.00'}`}
                {score?.tier === 0 ? null : <ArrowRight size={16} />}
              </button>
            )}
            {score?.tier === 0 && (
              <p className="mt-3 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Your current tier doesn't qualify for borrowing. Complete more on-chain transactions to build your score.
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-4 animate-fade-up">
            <InfoCard icon={Clock} title="Last Updated" value={score ? "Just now" : "--"} isLoading={isLoading} />
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
            <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading formula">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-16" />
              ))}
            </div>
          ) : score ? (
            <div className="rounded-2xl p-6 font-mono text-sm leading-8" style={{ background: 'var(--color-bg-card)' }}>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 max-w-sm">
                <span>score</span> <span className="text-slate-500">=</span> <span className="text-right">({score.metrics.txCount} x 2) = {score.formula.txComponent}</span>
                <span></span> <span className="text-slate-500">+</span> <span className="text-right">({score.metrics.repaymentCount} x 10) = {score.formula.repaymentComponent}</span>
                <span></span> <span className="text-slate-500">+</span> <span className="text-right">({score.metrics.avgBalanceFactor} x 5) = {score.formula.balanceComponent}</span>
                <span></span> <span className="text-slate-500">-</span> <span className="text-right">({score.metrics.defaultCount} x 25) = {score.formula.defaultPenalty}</span>
                <div className="col-span-3 border-t my-2 border-slate-700"></div>
                <span className="font-bold">Total</span> <span></span> <span className="text-right font-bold text-emerald-500">= {score.formula.total}</span>
              </div>
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
              ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-24" role="status" aria-busy="true" />)
              : [
                  { label: 'Avg balance', value: `${score?.metrics.avgBalance ?? 0} PHPC` },
                  { label: 'Balance factor', value: `${score?.metrics.avgBalanceFactor ?? 0}` },
                  { label: 'Defaults', value: `${score?.metrics.defaultCount ?? 0}` },
                  { label: 'Status', value: score?.tier === 0 ? 'Building' : 'Active' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
                    <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-bold tabular-nums">{item.value}</p>
                  </div>
                ))}
          </div>

          {(scoreQuery.isError && !generateMutation.isPending) || poolQuery.isError || loanStatusQuery.isError ? (
            <button
              onClick={() => {
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

function ScoreArc({ score, isLoading }: { score: number; isLoading: boolean }) {
  const maxScore = 850;
  const percentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-slate-800"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          style={{ 
            strokeDashoffset: isLoading ? circumference : offset,
            transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
            color: 'var(--color-accent)'
          }}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
