// frontend/app/loan/borrow/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TimerReset, Info, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { REQUIRED_NETWORK } from '@/lib/constants';
import { QUERY_KEYS } from '@/lib/queryKeys';
import StepBreadcrumb from '@/components/StepBreadcrumb';
import WalletConnectionBanner from '@/components/WalletConnectionBanner';
import { signTx } from '@/lib/freighter';

interface ScoreResponse {
  tier: number;
  tierLabel: string;
  borrowLimit: string;
  feeRate: number;
  feeBps: number;
}

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: string;
}

interface BorrowSuccess {
  amount: string;
  fee: string;
  feeBps: number;
  totalOwed: string;
  txHash: string;
  explorerUrl: string;
}

export default function BorrowPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'review' | 'confirm'>('review');
  const [txStep, setTxStep] = useState<number>(0); // 0: Idle, 1: Preparing, 2: Signing, 3: Submitting, 4: Confirming
  const [success, setSuccess] = useState<BorrowSuccess | null>(null);
  const [error, setError] = useState('');

  const { isConnected: walletConnected, network, connectionError: walletError } = useWalletStore();
  const isCorrectNetwork = network === REQUIRED_NETWORK;
  const canBorrow = walletConnected && isCorrectNetwork && agreed;

  const { data: score } = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
    enabled: !!user,
  });

  const { data: loanStatus, isLoading: isLoanStatusLoading } = useQuery({
    queryKey: QUERY_KEYS.loanStatus,
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }

    if (!isLoanStatusLoading && loanStatus?.hasActiveLoan && !success) {
      router.replace('/loan/repay');
    }
  }, [loanStatus, isLoanStatusLoading, router, user]);

  const borrowAmount = Number(score?.borrowLimit || 0);
  const fee = borrowAmount * ((score?.feeBps || 0) / 10_000);

  const handleBorrow = async () => {
    setLoading(true);
    setError('');
    setTxStep(1); // Preparing
    try {
      const { data } = await api.post('/loan/borrow', { amount: borrowAmount });

      if (data.requiresSignature) {
        setTxStep(2); // Signing
        const signResult = await signTx(data.unsignedXdr, user!.wallet!);
        if ('error' in signResult) throw new Error(signResult.error);

        setTxStep(3); // Submitting
        const result = await api.post('/loan/sign-and-submit', {
          signedInnerXdr: [signResult.signedXdr],
          flow: { action: 'borrow' },
        });

        setTxStep(4); // Confirming
        setSuccess(result.data);
      } else {
        setTxStep(4); // Confirming
        setSuccess(data);
      }

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Borrowing failed. Please try again.'));
      setTxStep(0);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center relative">
        <CelebrationParticles />
        <div className="card-elevated w-full animate-fade-up">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
            </div>
            <h1 className="text-3xl font-extrabold">Funds released</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your wallet received the loan instantly from the on-chain pool.
            </p>
          </div>

          <div className="mt-8 rounded-xl p-5 text-left" style={{ background: 'var(--color-bg-card)' }}>
            <Row label="Amount" value={`P${success.amount}`} />
            <Row label={`Fee (${(success.feeBps / 100).toFixed(2)}%)`} value={`P${success.fee}`} />
            <Row label="Total owed" value={`P${success.totalOwed}`} strong />
          </div>

          <a 
            href={success.explorerUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="mt-6 inline-flex text-sm font-medium transition-colors hover:brightness-110" 
            style={{ color: 'var(--color-accent)' }}
          >
            View on Stellar Expert ↗
          </a>

          <button onClick={() => router.push('/loan/repay')} className="btn-primary btn-accent mt-8">
            Continue to Repay
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 animate-fade-up">
        <StepBreadcrumb step={3} total={4} />
        <h1 className="mt-2 text-2xl font-extrabold lg:text-3xl">Borrow from the pool</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Eligibility is enforced by the on-chain tier stored in your Credit Passport.
        </p>
      </div>

      <WalletConnectionBanner />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-elevated animate-fade-up">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
            Approved amount
          </p>
          <p className="mt-4 text-5xl font-extrabold tabular-nums">P{borrowAmount.toFixed(2)}</p>
          <div className="mt-6 space-y-3" style={{ color: 'var(--color-text-secondary)' }}>
            <Row label="Tier" value={score?.tierLabel || 'Unrated'} />
            <Row label="Fee" value={`${(score?.feeRate || 0).toFixed(2)}%`} />
            <Row label="Term" value="30 days" />
            <Row label="Repayment" value={`P${(borrowAmount + fee).toFixed(2)}`} strong />
          </div>
        </div>

        <div className="flex flex-col gap-4 animate-fade-up">
          {step === 'review' ? (
            <div className="flex flex-col h-full">
              <div className="flex gap-3 rounded-xl p-4 text-sm mb-4" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-amber)' }}>
                <TimerReset className="mt-0.5 shrink-0" size={16} />
                <p>Repay before the due ledger to protect your score. Timely repayment improves the next score refresh.</p>
              </div>
              <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Info size={16} style={{ color: 'var(--color-accent)' }} />
                  Loan Review
                </h3>
                <ul className="text-xs space-y-2 list-disc pl-4" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>Instant disbursement to your connected wallet.</li>
                  <li>30-day fixed term.</li>
                  <li>Fee is deducted upon repayment, not from the principal.</li>
                </ul>
              </div>
              <button 
                onClick={() => setStep('confirm')}
                disabled={borrowAmount <= 0 || score?.tier === 0}
                className="btn-primary btn-accent mt-auto"
              >
                {borrowAmount <= 0 || score?.tier === 0 ? 'Not Eligible' : 'Review & Confirm'}
                <ArrowRight size={16} />
              </button>
              {score?.tier === 0 && (
                <p className="mt-2 text-[11px] text-center" style={{ color: 'var(--color-text-muted)' }}>
                  Your current tier doesn't qualify for borrowing.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <button 
                onClick={() => setStep('review')}
                className="text-xs mb-4 w-fit transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                ← Back to review
              </button>
              
              <label
                className="flex cursor-pointer items-start gap-3 rounded-xl p-4 text-sm transition-all"
                style={{
                  background: agreed ? 'var(--color-accent-glow)' : 'var(--color-bg-card)',
                  border: agreed ? '1px solid var(--color-border-accent)' : '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-[#22C55E] rounded"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>I confirm I want to borrow P{borrowAmount.toFixed(2)} and agree to repay within 30 days.</span>
              </label>

              {error || (walletConnected && !isCorrectNetwork ? walletError : null) ? (
                <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} role="alert">
                  {error || walletError}
                </div>
              ) : null}

              {!walletConnected && (
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                  <Wallet size={14} />
                  Connect your wallet first
                </div>
              )}

              {walletConnected && !isCorrectNetwork && (
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                  <Info size={14} />
                  Switch Freighter to Testnet
                </div>
              )}

              {walletConnected && isCorrectNetwork && !agreed && (
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--color-bg-card)', color: 'var(--color-accent)' }}>
                  <Info size={14} />
                  Check the box to confirm
                </div>
              )}

              <div className="mt-auto pt-6">
                {loading && (
                  <div className="mb-4">
                    <TransactionStepper currentStep={txStep} />
                  </div>
                )}
                <button 
                  onClick={handleBorrow} 
                  disabled={!canBorrow || loading} 
                  className="btn-primary btn-accent w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Confirm Borrow P{borrowAmount.toFixed(2)}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${strong ? 'mt-4 border-t pt-4 font-bold' : ''}`}
      style={strong ? { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' } : {}}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function TransactionStepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Preparing', id: 1 },
    { label: 'Signing', id: 2 },
    { label: 'Submitting', id: 3 },
    { label: 'Confirming', id: 4 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        {steps.map((s) => (
          <div 
            key={s.id} 
            className="flex flex-col items-center gap-1.5"
            style={{ opacity: currentStep >= s.id ? 1 : 0.3 }}
          >
            <div 
              className={`h-1.5 w-12 rounded-full transition-all duration-500 ${currentStep === s.id ? 'pulse-glow' : ''}`}
              style={{ background: currentStep >= s.id ? 'var(--color-accent)' : 'var(--color-bg-elevated)' }}
            />
            <span className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: currentStep >= s.id ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CelebrationParticles() {
  const [particles, setParticles] = useState<{ left: string; animationDelay: string; duration: string }[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }).map(() => ({
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 2}s`,
        duration: `${2 + Math.random() * 3}s`,
      }))
    );
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full"
          style={{
            background: i % 2 === 0 ? 'var(--color-accent)' : 'var(--color-amber)',
            top: '-20px',
            left: p.left,
            animation: `fall ${p.duration} linear infinite`,
            animationDelay: p.animationDelay,
            opacity: 0.6,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(600px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
