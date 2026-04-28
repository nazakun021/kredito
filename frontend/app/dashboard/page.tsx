'use client';

import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChartColumn, Coins, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth';

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

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [router, user]);

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
  const nextTierProgress = score?.nextTier
    ? Math.max(0, Math.min(100, ((score.score / score.nextTier.threshold) * 100)))
    : 100;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fdf8ef_0%,_#fff_40%,_#f3ebe0_100%)] px-5 py-6">
      <div className="rounded-[2rem] bg-[#1f1308] px-5 py-6 text-[#fff8ef] shadow-[0_30px_80px_rgba(38,20,5,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-orange-200">Credit Passport</p>
            <h1 className="mt-2 text-4xl font-black">{score?.score ?? '--'}</h1>
            <p className="mt-2 text-sm text-orange-100">
              {score?.tierLabel || 'Unrated'} tier • Borrow up to ₱{score?.borrowLimit?.toLocaleString?.() ?? 0}
            </p>
          </div>
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
            {loanStatus?.hasActiveLoan ? 'Loan Active' : 'Ready'}
          </div>
        </div>

        <div className="mt-6 rounded-[1.4rem] bg-white/8 p-4">
          <div className="mb-2 flex items-center justify-between text-sm text-orange-100">
            <span>Next level progress</span>
            <span>
              {score?.nextTier ? `${score.pointsToNextTier} pts to ${score.nextTier.label}` : 'Top tier unlocked'}
            </span>
          </div>
          <div className="h-3 rounded-full bg-white/10">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-orange-400 to-amber-200"
              style={{ width: `${nextTierProgress}%` }}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-[1.4rem] bg-orange-600 px-5 py-4 font-bold text-white shadow-[0_18px_40px_rgba(234,88,12,0.24)] disabled:opacity-50"
      >
        <RefreshCw size={18} className={generateMutation.isPending ? 'animate-spin' : ''} />
        {generateMutation.isPending ? 'Refreshing on-chain score...' : 'Refresh On-Chain Score'}
      </button>

      <div className="mt-5 grid gap-3">
        <InfoCard
          icon={Coins}
          title="Pool balance"
          value={`₱${Number(loanStatus?.poolBalance || 0).toLocaleString()}`}
          copy="Pre-funded liquidity for the live demo."
        />
        <InfoCard
          icon={Wallet}
          title="Demo wallet"
          value={`${user.stellarAddress.slice(0, 6)}...${user.stellarAddress.slice(-6)}`}
          copy="Generated automatically and stored server-side for the demo session."
        />
      </div>

      <section className="mt-5 rounded-[1.7rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(28,25,23,0.08)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-stone-100 p-2 text-stone-700">
            <ChartColumn size={18} />
          </div>
          <div>
            <h2 className="font-bold">Transparent scoring</h2>
            <p className="text-sm text-stone-500">{score?.formula}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {score?.factors?.map((factor) => (
            <div key={factor.key} className="rounded-[1.2rem] bg-stone-50 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-stone-800">{factor.label}</p>
                <p className="text-sm font-bold text-orange-700">{factor.points > 0 ? '+' : ''}{factor.points} pts</p>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                Raw value: <span className="font-semibold text-stone-700">{factor.value}</span> • {factor.weight}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-[1.7rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(28,25,23,0.08)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-stone-100 p-2 text-stone-700">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="font-bold">Raw metrics</h2>
            <p className="text-sm text-stone-500">Anyone can recompute this score from the same inputs.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="tx_count" value={score?.metrics?.txCount ?? 0} />
          <MetricTile label="repayment_count" value={score?.metrics?.repaymentCount ?? 0} />
          <MetricTile label="avg_balance" value={score?.metrics?.avgBalance ?? 0} />
          <MetricTile label="default_count" value={score?.metrics?.defaultCount ?? 0} />
        </div>
      </section>

      <section className="mt-5 rounded-[1.7rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(28,25,23,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Instant approval</p>
            <h2 className="mt-1 text-2xl font-black text-stone-900">
              {loanStatus?.hasActiveLoan ? 'Repay and level up' : `Borrow up to ₱${score?.borrowLimit?.toLocaleString?.() ?? 0}`}
            </h2>
          </div>
          <div className="rounded-full bg-orange-100 px-3 py-2 text-sm font-bold text-orange-700">
            Fee {((score?.feeBps ?? 0) / 100).toFixed(2)}%
          </div>
        </div>

        {loanStatus?.hasActiveLoan ? (
          <div className="mt-5">
            <div className="rounded-[1.2rem] bg-stone-50 p-4 text-sm text-stone-600">
              Outstanding: <span className="font-bold text-stone-900">₱{loanStatus.loan?.totalOwed ?? '0.00'}</span>
            </div>
            <button
              onClick={() => router.push('/loan/repay')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.3rem] bg-stone-950 px-5 py-4 font-bold text-white"
            >
              Repay now
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/loan/borrow')}
            disabled={!score || score.tier === 0}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[1.3rem] bg-stone-950 px-5 py-4 font-bold text-white disabled:opacity-40"
          >
            Borrow instantly
            <ArrowRight size={18} />
          </button>
        )}
      </section>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  copy,
}: {
  icon: typeof Wallet;
  title: string;
  value: string;
  copy: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-[0_18px_40px_rgba(28,25,23,0.06)]">
      <div className="mb-3 inline-flex rounded-full bg-stone-100 p-2 text-stone-700">
        <Icon size={18} />
      </div>
      <p className="text-sm uppercase tracking-[0.18em] text-stone-500">{title}</p>
      <p className="mt-2 text-lg font-bold text-stone-900">{value}</p>
      <p className="mt-2 text-sm text-stone-500">{copy}</p>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.2rem] bg-stone-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-stone-900">{value}</p>
    </div>
  );
}
