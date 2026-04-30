'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TrendingUp, Wallet, Info } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { REQUIRED_NETWORK } from '@/lib/constants';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { tierGradient } from '@/lib/tiers';
import StepBreadcrumb from '@/components/StepBreadcrumb';
import WalletConnectionBanner from '@/components/WalletConnectionBanner';
import { signTx } from '@/lib/freighter';

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  walletPhpBalance: string;
  loan: null | {
    principal: string;
    fee: string;
    totalOwed: string;
    walletBalance: string;
    shortfall: string;
    dueDate: string;
    daysRemaining: number;
    status: string;
  };
}

interface RepaySuccess {
  txHash: string;
  amountRepaid: string;
  previousScore: number | null;
  newScore: number;
  newTier: string;
  newBorrowLimit: string;
  explorerUrl: string;
}

export default function RepayPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [txStep, setTxStep] = useState<number>(0);
  const [txStepLabel, setTxStepLabel] = useState<'Approving PHPC spend…' | 'Submitting repayment…' | 'Processing...'>('Processing...');
  const [success, setSuccess] = useState<RepaySuccess | null>(null);
  const [error, setError] = useState('');

  const { isConnected: walletConnected, network, connectionError: walletError } = useWalletStore();
  const isCorrectNetwork = network === REQUIRED_NETWORK;
  const canRepay = walletConnected && isCorrectNetwork;

  const { data: status, isLoading: isStatusLoading } = useQuery({
    queryKey: QUERY_KEYS.loanStatus,
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }

    if (!isStatusLoading && status && !status.hasActiveLoan && !success) {
      router.replace('/dashboard');
    }
  }, [isStatusLoading, router, status, user, success]);

  const handleRepay = async () => {
    setLoading(true);
    setError('');
    
    try {
      setTxStepLabel('Processing...');
      setTxStep(1); // Preparing (Check if approve needed)
      const { data } = await api.post('/loan/repay');

      if (data.requiresSignature) {
        if (data.step === 'approve') {
          setTxStepLabel('Approving PHPC spend…');
          setTxStep(2); // Signing (Approve)
          const approveResult = await signTx(data.unsignedXdr, user!.wallet!);
          if ('error' in approveResult) throw new Error(approveResult.error);

          setTxStep(3); // Submitting (Approve)
          await api.post('/loan/sign-and-submit', {
            signedInnerXdr: [approveResult.signedXdr],
            flow: { action: 'repay', step: 'approve' },
          });

          // Phase 2: Repay
          setTxStepLabel('Submitting repayment…');
          setTxStep(1); // Preparing (Repay)
          const repayData = await api.post('/loan/repay').then(res => res.data);
          
          setTxStep(2); // Signing (Repay)
          const repayResult = await signTx(repayData.unsignedXdr, user!.wallet!);
          if ('error' in repayResult) throw new Error(repayResult.error);

          setTxStep(3); // Submitting (Repay)
          const finalResult = await api.post('/loan/sign-and-submit', {
            signedInnerXdr: [repayResult.signedXdr],
            flow: { action: 'repay', step: 'repay' },
          });
          setTxStep(4); // Confirming
          setSuccess(finalResult.data);
        } else if (data.step === 'repay') {
          setTxStepLabel('Submitting repayment…');
          setTxStep(2); // Signing (Repay)
          const repayResult = await signTx(data.unsignedXdr, user!.wallet!);
          if ('error' in repayResult) throw new Error(repayResult.error);

          setTxStep(3); // Submitting (Repay)
          const result = await api.post('/loan/sign-and-submit', {
            signedInnerXdr: [repayResult.signedXdr],
            flow: { action: 'repay', step: 'repay' },
          });
          setTxStep(4); // Confirming
          setSuccess(result.data);
        }
      } else {
        // Internal wallet flow
        setTxStep(4); // Confirming
        setSuccess(data);
      }

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.score(user?.wallet ?? '') });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Repayment failed. Please try again.'));
      setTxStep(0);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const tierValue = success.newTier === 'Gold' ? 3 : success.newTier === 'Silver' ? 2 : success.newTier === 'Bronze' ? 1 : 0;
    
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center relative">
        <CelebrationParticles />
        <div className="card-elevated w-full animate-fade-up">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
            </div>

            <StepBreadcrumb step={4} total={4} />
            <h1 className="mt-2 text-3xl font-extrabold">Repaid on time</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              The loan is closed and your Credit Passport can now unlock a stronger tier.
            </p>
          </div>

          <div className="mt-8 rounded-xl p-6 text-left" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--color-accent)' }}>
              <TrendingUp size={16} />
              <p className="text-xs font-bold uppercase tracking-wider">Live score result</p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>Updated score</p>
                <p className="text-5xl font-extrabold tabular-nums">{success.newScore}</p>
              </div>
              <div className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg" style={{ background: tierGradient(tierValue), color: '#020617' }}>
                {success.newTier}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {success.previousScore !== null ? `Score: ${success.previousScore} → ${success.newScore}` : 'Score refreshed on-chain'}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Borrow limit now: <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>P{success.newBorrowLimit}</span>
              </p>
            </div>
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

          <button onClick={() => router.push('/dashboard')} className="btn-primary btn-accent mt-8 w-full">
            Back to Passport
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const isOverdue = (status?.loan?.daysRemaining ?? 0) < 0;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 animate-fade-up">
        <StepBreadcrumb step={4} total={4} />
        <h1 className="mt-2 text-2xl font-extrabold lg:text-3xl">Active Loan</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Timely repayment feeds into the next metrics refresh and upgrades your Credit Passport.
        </p>
      </div>

      <WalletConnectionBanner />

      <div className="card-elevated animate-fade-up">
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--color-bg-card)' }}>
          <Row label="Principal" value={`P${status?.loan?.principal ?? '0.00'}`} />
          <Row label="Fee owed" value={`P${status?.loan?.fee ?? '0.00'}`} />
          <Row label="Total due" value={`P${status?.loan?.totalOwed ?? '0.00'}`} strong />
          <Row label="Wallet PHPC" value={`P${status?.loan?.walletBalance ?? status?.walletPhpBalance ?? '0.00'}`} />
          {status?.loan?.shortfall && status.loan.shortfall !== '0.00' ? (
            <Row label="Still needed" value={`P${status.loan.shortfall}`} tone="danger" />
          ) : null}
          <Row label="Due date" value={status?.loan?.dueDate ? new Date(status.loan.dueDate).toLocaleDateString() : '-'} />
          <Row
            label="Status"
            value={isOverdue ? 'Overdue' : status?.loan ? `${status.loan.daysRemaining} days left` : '-'}
            tone={isOverdue ? 'danger' : status?.loan ? (status.loan.daysRemaining <= 7 ? 'amber' : 'success') : undefined}
          />
        </div>

        {status?.loan?.shortfall && status.loan.shortfall !== '0.00' ? (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium flex gap-3" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-amber)' }}>
            <Info size={18} className="shrink-0" />
            <p>Top up at least P{status.loan.shortfall} more PHPC in this wallet before repaying — the fee is not auto-funded.</p>
          </div>
        ) : null}

        {error || (walletConnected && !isCorrectNetwork ? walletError : null) ? (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} role="alert">
            {error || walletError}
          </div>
        ) : null}

        <div className="mt-6">
          {loading && (
            <div className="mb-4">
              <TransactionStepper currentStep={txStep} label={txStepLabel} />
            </div>
          )}
          <button 
            onClick={handleRepay} 
            disabled={loading || !canRepay} 
            className="btn-primary btn-accent w-full"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {txStepLabel}
              </>
            ) : (
              `Repay P${status?.loan?.totalOwed ?? '0.00'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'success' | 'amber' | 'danger';
}) {
  const color =
    tone === 'danger'
      ? 'var(--color-danger)'
      : tone === 'amber'
        ? 'var(--color-amber)'
        : tone === 'success'
          ? 'var(--color-success)'
          : undefined;

  return (
    <div
      className={`flex items-center justify-between text-sm ${strong ? 'mt-4 border-t pt-4 font-bold' : ''}`}
      style={strong ? { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' } : { color: 'var(--color-text-secondary)' }}
    >
      <span>{label}</span>
      <span className="tabular-nums font-mono" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function TransactionStepper({ currentStep, label }: { currentStep: number, label?: string }) {
  const steps = [
    { label: 'Preparing', id: 1 },
    { label: 'Signing', id: 2 },
    { label: 'Submitting', id: 3 },
    { label: 'Confirming', id: 4 },
  ];

  return (
    <div className="space-y-4">
      {label && <div className="text-sm font-semibold text-center text-slate-300">{label}</div>}
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