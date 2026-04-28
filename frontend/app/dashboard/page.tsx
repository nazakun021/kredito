'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChartColumn,
  Coins,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

/* ─── Types ─── */
interface ScoreFactor {
  key: string;
  label: string;
  value: number;
  weight: string;
  points: number;
}

interface ScoreResponse {
  score: number;
  tier: number;
  tierLabel: string;
  borrowLimit: number;
  feeBps: number;
  formula: string;
  metrics: {
    txCount: number;
    repaymentCount: number;
    avgBalance: number;
    defaultCount: number;
  };
  factors: ScoreFactor[];
  nextTier: { threshold: number; label: string } | null;
  pointsToNextTier: number;
}

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: number;
  loan: null | {
    totalOwed: string;
  };
}

/* ─── Tier Helpers ─── */
function tierGradient(tier: number) {
  switch (tier) {
    case 3: return 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)';
    case 2: return 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)';
    case 1: return 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)';
    default: return 'linear-gradient(135deg, #475569 0%, #64748B 100%)';
  }
}

/* ─── Page ─── */
export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const scoreQuery = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
    enabled: !!user,
  });

  const loanStatusQuery = useQuery({
    queryKey: ['loan-status'],
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: !!user,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post('/credit/generate').then((res) => res.data),
    onSuccess: () => {
      scoreQuery.refetch();
      loanStatusQuery.refetch();
    },
  });

  if (!user) return null;

  const score = scoreQuery.data;
  const loanStatus = loanStatusQuery.data;
  const isLoading = scoreQuery.isLoading;
  const nextTierProgress = score?.nextTier
    ? Math.max(0, Math.min(100, (score.score / score.nextTier.threshold) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ─── Page Header ─── */}
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Your Credit Passport overview
        </p>
      </div>

      {/* ─── Top Row: Score + Loan Action ─── */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Score Hero (wider) */}
        <section
          className="lg:col-span-3 rounded-2xl p-6 animate-fade-up"
          style={{
            animationDelay: '50ms',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Credit Score
                </p>
                <div
                  className="h-1.5 w-1.5 rounded-full pulse-glow"
                  style={{ background: 'var(--color-accent)' }}
                />
              </div>
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
              {score?.tierLabel || 'Unrated'}
            </div>
          </div>

          <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Borrow up to <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>₱{score?.borrowLimit?.toLocaleString?.() ?? '0'}</span>
            {' '}· Fee {((score?.feeBps ?? 0) / 100).toFixed(2)}%
          </p>

          {/* Progress */}
          <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(148, 163, 184, 0.06)' }}>
            <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              <span>Next tier progress</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {score?.nextTier
                  ? `${score.pointsToNextTier} pts to ${score.nextTier.label}`
                  : 'Top tier ✓'}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-bg-elevated)' }}>
              <div
                className="h-2 rounded-full progress-animated"
                style={{ width: `${nextTierProgress}%`, background: tierGradient(score?.tier ?? 0) }}
              />
            </div>
          </div>

          {/* Refresh */}
          <button
            id="btn-refresh-score"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-primary btn-dark mt-5 cursor-pointer"
          >
            <RefreshCw size={16} className={generateMutation.isPending ? 'animate-spin' : ''} />
            {generateMutation.isPending ? 'Refreshing on-chain score…' : 'Refresh On-Chain Score'}
          </button>
        </section>

        {/* Loan Action + Quick Info (right column) */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Loan Action */}
          <section
            className="card-elevated flex-1 animate-fade-up"
            style={{ animationDelay: '100ms' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Instant approval
                </p>
                <h2 className="mt-1 text-lg font-extrabold">
                  {loanStatus?.hasActiveLoan
                    ? 'Repay and level up'
                    : `₱${score?.borrowLimit?.toLocaleString?.() ?? '0'}`}
                </h2>
              </div>
              <div
                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{
                  background: 'var(--color-accent-glow)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border-accent)',
                }}
              >
                Fee {((score?.feeBps ?? 0) / 100).toFixed(2)}%
              </div>
            </div>

            {loanStatus?.hasActiveLoan ? (
              <div className="mt-4">
                <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-bg-card)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Outstanding: </span>
                  <span className="font-bold tabular-nums">₱{loanStatus.loan?.totalOwed ?? '0.00'}</span>
                </div>
                <button
                  id="btn-repay"
                  onClick={() => router.push('/loan/repay')}
                  className="btn-primary btn-accent mt-4 cursor-pointer"
                >
                  Repay now
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <button
                id="btn-borrow"
                onClick={() => router.push('/loan/borrow')}
                disabled={!score || score.tier === 0}
                className="btn-primary btn-accent mt-5 cursor-pointer"
              >
                Borrow instantly
                <ArrowRight size={16} />
              </button>
            )}
          </section>

          {/* Quick Info */}
          <div className="grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '150ms' }}>
            <InfoCard
              icon={Coins}
              title="Pool"
              value={`₱${Number(loanStatus?.poolBalance || 0).toLocaleString()}`}
              isLoading={loanStatusQuery.isLoading}
            />
            <InfoCard
              icon={Wallet}
              title="Wallet"
              value={`${user.stellarAddress.slice(0, 4)}…${user.stellarAddress.slice(-4)}`}
              isLoading={false}
            />
          </div>
        </div>
      </div>

      {/* ─── Bottom Row: Scoring + Metrics ─── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Transparent Scoring */}
        <section className="card-elevated animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-bg-elevated)' }}
            >
              <ChartColumn size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Transparent scoring</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{score?.formula}</p>
            </div>
          </div>

          <div className="space-y-2">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-16" />
                ))
              : score?.factors?.map((factor) => (
                  <div
                    key={factor.key}
                    className="flex items-center justify-between rounded-xl p-3"
                    style={{ background: 'var(--color-bg-card)' }}
                  >
                    <div>
                      <p className="text-sm font-semibold">{factor.label}</p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Raw: <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{factor.value}</span> · {factor.weight}
                      </p>
                    </div>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: factor.points >= 0 ? 'var(--color-accent)' : 'var(--color-danger)' }}
                    >
                      {factor.points > 0 ? '+' : ''}{factor.points}
                    </span>
                  </div>
                ))}
          </div>
        </section>

        {/* Raw Metrics */}
        <section className="card-elevated animate-fade-up" style={{ animationDelay: '250ms' }}>
          <div className="mb-5 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-bg-elevated)' }}
            >
              <TrendingUp size={16} style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-bold">Raw metrics</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Anyone can recompute from the same inputs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-24" />
                ))
              : (
                <>
                  <MetricTile label="tx_count" value={score?.metrics?.txCount ?? 0} />
                  <MetricTile label="repayment_count" value={score?.metrics?.repaymentCount ?? 0} />
                  <MetricTile label="avg_balance" value={score?.metrics?.avgBalance ?? 0} />
                  <MetricTile label="default_count" value={score?.metrics?.defaultCount ?? 0} />
                </>
              )}
          </div>

          {/* Verifiability note */}
          <div
            className="mt-5 flex items-start gap-3 rounded-xl p-4 text-sm"
            style={{ background: 'rgba(34, 197, 94, 0.06)', color: 'var(--color-text-secondary)' }}
          >
            <ShieldCheck size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
            <p>All metrics are sourced from Stellar Horizon and on-chain contract events. The scoring formula is deterministic and publicly verifiable.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Components ─── */
function InfoCard({
  icon: Icon,
  title,
  value,
  isLoading,
}: {
  icon: typeof Wallet;
  title: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <div className="card">
      <div
        className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: 'var(--color-bg-elevated)' }}
      >
        <Icon size={14} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </p>
      {isLoading ? (
        <div className="skeleton mt-2 h-5 w-16" />
      ) : (
        <p className="mt-2 text-sm font-bold tabular-nums">{value}</p>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
      <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
