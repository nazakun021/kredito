// frontend/app/dashboard/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Send,
  Loader2,
  X,
  ShieldAlert,
  Info,
} from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { tierGradient, tierContextPhrase } from '@/lib/tiers';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useWalletStore } from '@/store/walletStore';
import { signTx } from '@/lib/freighter';
import { NETWORK_PASSPHRASE } from '@/lib/constants';
import { toast } from 'sonner';

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
  kycVerified: boolean;
  formula: {
    expression: string;
    txComponent: number;
    repaymentComponent: number;
    balanceComponent: number;
    defaultPenalty: number;
    horizonBonus: number;
    total: number;
  };
  metrics: {
    txCount: number;
    repaymentCount: number;
    xlmBalance: number;
    xlmBalanceFactor: number;
    defaultCount: number;
  };
  factors?: {
    key: string;
    label: string;
    value: number;
    weight: string;
    points: number;
  }[];
  horizonMetrics?: {
    walletAgeDays: number;
    txCount: number;
    currentBalanceXlm: string;
    inboundPaymentCount: number;
    activitySpanDays: number;
    hasRegularActivity: boolean;
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
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = !!user && !!token;
  const [isScoreDetailsOpen, setIsScoreDetailsOpen] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showKycWarningModal, setShowKycWarningModal] = useState(false);

  // 1. Primary: Get the latest cached score (fast)
  const scoreQuery = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: async () => {
      try {
        return await api.get<ScoreResponse>('/credit/score').then((res) => res.data);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        if (error?.response?.status === 404) return null; // no score yet, not an error
        throw err;
      }
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // 2. Secondary: Generate a new score if none exists or user clicks refresh
  const generateMutation = useMutation({
    mutationFn: () => api.post<ScoreResponse>('/credit/generate').then((res) => res.data),
    onSuccess: async (data) => {
      queryClient.setQueryData(QUERY_KEYS.score(user?.wallet ?? ''), data);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? '') });
    },
  });

  // 3. Auto-trigger generate only if score is missing (null)
  const isScoreMissing = scoreQuery.data === null;
  const mutate = generateMutation.mutate;
  useEffect(() => {
    if (
      isScoreMissing &&
      !generateMutation.isPending &&
      !generateMutation.data &&
      !generateMutation.isError
    ) {
      mutate();
    }
  }, [
    isScoreMissing,
    generateMutation.isPending,
    generateMutation.data,
    generateMutation.isError,
    mutate,
  ]);

  const poolQuery = useQuery({
    queryKey: QUERY_KEYS.pool,
    queryFn: () => api.get<{ poolBalance: string }>('/credit/pool').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const loanStatusQuery = useQuery({
    queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? ''),
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const stakingPositionQuery = useQuery({
    queryKey: ['staking-position', user?.wallet],
    queryFn: () => api.get<{ stakedAmount: string }>('/staking/position').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const walletBalanceQuery = useQuery({
    queryKey: ['wallet-balance', user?.wallet],
    queryFn: () => api.get<{ xlmBalance: string, phpEquivalent: string }>('/wallet/balance').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const depositPositionQuery = useQuery({
    queryKey: ['deposit-position', user?.wallet],
    queryFn: () => api.get<{ amount: string } | null>('/deposit/position').then((res) => res.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  if (!isAuthenticated) return null;

  const score = scoreQuery.data ?? generateMutation.data;
  const loanStatus = loanStatusQuery.data;
  const position = stakingPositionQuery.data;
  const deposit = depositPositionQuery.data;
  const isLoading = !score && (scoreQuery.isLoading || generateMutation.isPending);
  const scoreError =
    scoreQuery.isError && !isScoreMissing
      ? 'Unable to load your score right now. Please try again.'
      : generateMutation.isError
        ? getErrorMessage(generateMutation.error, 'Unable to generate your on-chain score right now.')
        : '';
  const poolValue = poolQuery.isError ? 'Pool balance unavailable' : `◎${poolQuery.data?.poolBalance ?? '0.00'}`;
  const loanStatusUnavailable = loanStatusQuery.isError;
  
  const nextTierProgress = score?.nextTierThreshold
    ? Math.max(0, Math.min(100, (score.score / score.nextTierThreshold) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-6xl pb-6">
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
          <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
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
              className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg flex items-center gap-2"
              style={{ background: tierGradient(score?.tier ?? 0), color: '#020617' }}
            >
              {score?.kycVerified && <ShieldCheck size={16} />}
              {score?.tierLabel ?? 'Unrated'}
            </div>
          </div>

          {!score?.kycVerified && (
            <div 
              className="mt-6 flex items-center justify-between rounded-xl p-4 transition-all hover:brightness-110 cursor-pointer"
              style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}
              onClick={() => router.push('/kyc')}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold">Boost your limit</p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Verify KYC to unlock Platinum tier</p>
                </div>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--color-accent)' }} />
            </div>
          )}

          <div className="mt-8 grid gap-3 sm:grid-cols-2 relative z-10">
            <Metric label="Borrow limit" value={`◎${score?.borrowLimit ?? '0.00'}`} loading={isLoading} />
            <Metric label="Fee rate" value={`${(score?.feeRate ?? 0).toFixed(2)}%`} loading={isLoading} />
          </div>

          {/* Score Breakdown Dropdown */}
          <div className="mt-6 relative z-10">
            <button
              onClick={() => setIsScoreDetailsOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-xl p-4 text-left transition-all hover:bg-white/5"
              style={{ background: 'rgba(148, 163, 184, 0.06)' }}
              aria-expanded={isScoreDetailsOpen}
            >
              <div className="flex items-center gap-3">
                <Info size={16} style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm font-bold">Score Breakdown</span>
              </div>
              <ChevronDown
                size={16}
                style={{ color: 'var(--color-text-muted)' }}
                className={`transition-transform duration-300 ${isScoreDetailsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{ 
                maxHeight: isScoreDetailsOpen ? '500px' : '0px',
                opacity: isScoreDetailsOpen ? 1 : 0,
              }}
            >
              <div className="pt-3 space-y-2 px-1">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton h-12" />
                  ))
                ) : score?.factors ? (
                  score.factors.map((factor) => (
                    <div 
                      key={factor.key} 
                      className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
                      style={{ background: 'var(--color-bg-card)' }}
                    >
                      <div>
                        <p className="text-sm font-semibold">{factor.label}</p>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {factor.weight}
                        </p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${factor.points < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {factor.points > 0 ? '+' : ''}{factor.points}
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <ScoreFactorRow label="Transactions" detail={`${score?.metrics.txCount ?? 0} × 1`} points={score?.formula.txComponent ?? 0} />
                    <ScoreFactorRow label="Repayments" detail={`${score?.metrics.repaymentCount ?? 0} × 15`} points={score?.formula.repaymentComponent ?? 0} />
                    <ScoreFactorRow label="Balance Factor" detail={`${score?.metrics.xlmBalanceFactor ?? 0} × 5`} points={score?.formula.balanceComponent ?? 0} />
                    <ScoreFactorRow label="Default Penalty" detail={`${score?.metrics.defaultCount ?? 0} × -30`} points={-(score?.formula.defaultPenalty ?? 0)} />
                    {(score?.formula.horizonBonus ?? 0) > 0 && (
                      <ScoreFactorRow label="Horizon Bonus" detail="wallet age + activity" points={score?.formula.horizonBonus ?? 0} />
                    )}
                  </>
                )}
                <div className="flex items-center justify-between rounded-xl px-4 py-3 mt-1"
                  style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}>
                  <span className="text-sm font-bold">Total Score</span>
                  <span className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                    {score?.score ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress to next tier */}
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
            disabled={generateMutation.isPending || (!score && isLoading)}
            className="btn-primary btn-dark mt-6 relative z-10 w-full sm:w-auto"
          >
            <RefreshCw size={16} className={generateMutation.isPending ? 'animate-spin' : ''} aria-hidden="true" />
            {generateMutation.isPending ? 'Refreshing on-chain score...' : 'Refresh On-Chain Score'}
          </button>
          {scoreError ? (
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--color-danger)' }} role="alert">
              {scoreError}
            </p>
          ) : null}
        </section>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <section className="card-elevated flex-1 animate-fade-up">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  XLM Lending Pool
                </p>
                <h2 className="mt-1 text-lg font-extrabold">{poolValue}</h2>
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
              {poolQuery.isError ? 'Try refreshing again in a moment.' : 'Funded by lenders, NGOs, and DAOs.'}
            </p>

            {loanStatusUnavailable ? (
              <div className="mt-5">
                <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-bg-card)' }}>
                  Loan status unavailable
                </div>
                <button className="btn-primary btn-accent mt-4" disabled>
                  Loan status unavailable
                </button>
              </div>
            ) : loanStatus?.hasActiveLoan ? (
              <div className="mt-5">
                <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--color-bg-card)' }}>
                  Outstanding: <span className="font-bold">◎{loanStatus.loan?.totalOwed ?? '0.00'}</span>
                </div>
                <button onClick={() => router.push('/loan/repay')} className="btn-primary btn-accent mt-4">
                  Repay Active Loan
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push('/loan/borrow')}
                disabled={!score || score.tier === 0 || isLoading}
                className="btn-primary btn-accent mt-5"
              >
                {score?.tier === 0 ? 'Tier too low to borrow' : `Borrow ◎${score?.borrowLimit ?? '0.00'}`}
                {score?.tier === 0 ? null : <ArrowRight size={16} aria-hidden="true" />}
              </button>
            )}
          </section>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <QuickStat 
              label="Staked" 
              value={`◎${position?.stakedAmount ?? '0.0'}`} 
              href="/staking" 
            />
            <QuickStat 
              label="Deposits" 
              value={deposit?.amount ? '1 Active' : '0'} 
              href="/deposit" 
            />
          </div>

          <div className="card-elevated animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet size={20} style={{ color: 'var(--color-text-secondary)' }} />
                <h3 className="font-bold text-sm">Wallet</h3>
              </div>
              <div className="rounded-md px-2 py-1 text-[10px] font-mono tracking-wider font-bold" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
                {user.wallet.slice(0, 6)}…{user.wallet.slice(-6)}
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Available Balance
              </p>
              {walletBalanceQuery.isLoading ? (
                <div className="skeleton h-10 w-32" />
              ) : (
                <div className="flex items-end gap-2">
                  <h2 className="text-3xl font-extrabold tabular-nums">
                    ◎{Number(walletBalanceQuery.data?.xlmBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                  <p className="mb-1 text-sm font-medium opacity-60">
                    ≈ ₱{Number(walletBalanceQuery.data?.phpEquivalent ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (score && !score.kycVerified) {
                    setShowKycWarningModal(true);
                  } else {
                    setShowSendModal(true);
                  }
                }}
                className="btn-primary btn-accent flex-1 justify-center"
              >
                <Send size={16} />
                Send
              </button>
              <button 
                onClick={() => router.push('/wallet')}
                className="btn-primary btn-dark flex-1 justify-center"
              >
                View Activity
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 animate-fade-up">
        <section className="card-elevated">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-bg-elevated)' }}>
              <TrendingUp size={16} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Horizon metrics</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Deterministic inputs read directly from the Stellar network.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-24" role="status" aria-busy="true" />)
              : [
                  { label: 'Account Age', value: `${score?.horizonMetrics?.walletAgeDays ?? 0} days` },
                  { label: 'XLM Balance', value: `◎${score?.horizonMetrics?.currentBalanceXlm ?? '0.00'}` },
                  { label: 'KYC Status', value: score?.kycVerified ? 'Verified' : 'Pending' },
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

      {/* Send Modal */}
      {showSendModal && (
        <SendModal 
          onClose={() => setShowSendModal(false)} 
          balance={walletBalanceQuery.data?.xlmBalance ?? '0'} 
        />
      )}

      {/* KYC Warning Modal */}
      {showKycWarningModal && (
        <KycRequiredModal 
          onClose={() => setShowKycWarningModal(false)} 
        />
      )}
    </div>
  );
}

function ScoreFactorRow({ label, detail, points }: { label: string; detail: string; points: number }) {
  return (
    <div 
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: 'var(--color-bg-card)' }}
    >
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{detail}</p>
      </div>
      <span className={`text-sm font-bold tabular-nums ${points < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
        {points > 0 ? '+' : ''}{points}
      </span>
    </div>
  );
}

function KycRequiredModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated w-full max-w-md animate-scale-in text-center p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
        <div className="w-full flex justify-end mb-2">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-6">
          <ShieldAlert size={32} />
        </div>
        <h3 className="text-xl font-extrabold mb-3">Identity Verification Required</h3>
        <p className="text-sm opacity-70 mb-8 leading-relaxed">
          To comply with safety standards and regulatory requirements, all outbound XLM transfers and withdrawals require an active on-chain KYC verification.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onClose();
              router.push('/kyc');
            }}
            className="btn-primary btn-accent w-full justify-center"
          >
            Start KYC Verification
          </button>
          <button
            onClick={onClose}
            className="btn-primary btn-dark w-full justify-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function SendModal({ onClose, balance }: { onClose: () => void; balance: string }) {
  const user = useAuthStore((s) => s.user);
  const { networkPassphrase } = useWalletStore();
  const queryClient = useQueryClient();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !amount) return;

    setLoading(true);
    try {
      const { data } = await api.post('/wallet/send', { destination: address, amount });
      
      const signResult = await signTx(
         data.unsignedXdr, 
         user!.wallet!, 
         networkPassphrase ?? NETWORK_PASSPHRASE
      );
      
      if ('error' in signResult) throw new Error(signResult.error);

      await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [signResult.signedXdr],
        flow: { action: 'send' },
      });

      toast.success('XLM sent successfully!');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wallet-balance'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] })
      ]);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-scale-in">
      <div className="card-elevated w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-extrabold">Send XLM</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest opacity-50">Recipient Address</span>
            <input 
              required
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none bg-slate-900 border-slate-800 focus:border-emerald-500 transition-colors"
              placeholder="G..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest opacity-50">Amount (XLM)</span>
              <span className="text-[10px] opacity-50">Balance: ◎{balance}</span>
            </div>
            <input 
              required
              type="number"
              step="0.0000001"
              min="0.0000001"
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none bg-slate-900 border-slate-800 focus:border-emerald-500 transition-colors"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button disabled={loading} type="submit" className="btn-primary btn-accent w-full mt-4">
            {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
            {loading ? 'Processing...' : 'Send XLM'}
          </button>
        </form>
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

function QuickStat({ label, value, href }: { label: string; value: string; href: string }) {
  const router = useRouter();
  return (
    <div 
      onClick={() => router.push(href)}
      className="card-elevated cursor-pointer hover:brightness-110 transition-all p-4"
    >
      <p className="text-[10px] font-semibold tracking-widest uppercase opacity-40">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ScoreArc({ score, isLoading }: { score: number; isLoading: boolean }) {
  const maxScore = 250;
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
