'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TrendingUp, Info } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { REQUIRED_NETWORK } from '@/lib/constants';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { tierGradient } from '@/lib/tiers';
import StepBreadcrumb from '@/components/StepBreadcrumb';
import WalletConnectionBanner from '@/components/WalletConnectionBanner';
import CelebrationParticles from '@/components/CelebrationParticles';
import SummaryRow from '@/components/SummaryRow';
import { signTx } from '@/lib/freighter';

interface LoanStatusResponse {
  hasActiveLoan: boolean;
  poolBalance: string;
  loan: null | {
    principal: string;
    fee: string;
    totalOwed: string;
    walletBalance: string;
    shortfall: string;
    dueLedger: number;
    currentLedger: number;
    dueDate: string;
    daysRemaining: number;
    status: string;
    repaid: boolean;
    defaulted: boolean;
  };
}

interface RepaySuccess {
  txHash: string;
  amountRepaid: string;
  previousScore: number | null;
  newScore: number;
  newTier: string;
  newTierNumeric: number;
  newBorrowLimit: string;
  explorerUrl: string;
}

export default function RepayPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = !!user && !!token;
  const [loading, setLoading] = useState(false);
  const [txStep, setTxStep] = useState<number>(0);
  const [success, setSuccess] = useState<RepaySuccess | null>(null);
  const [error, setError] = useState('');

  const { isConnected: walletConnected, network, connectionError: walletError } = useWalletStore();
  const isCorrectNetwork = network === REQUIRED_NETWORK;
  const canRepay = walletConnected && isCorrectNetwork;

  const { data: status, isLoading: isStatusLoading } = useQuery({
    queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? ''),
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    if (!isStatusLoading && status && !status.hasActiveLoan && !success) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isStatusLoading, router, status, success]);

  const handleRepay = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (!user?.wallet) {
        throw new Error('Wallet not connected.');
      }

      setTxStep(1);
      const { data } = await api.post('/loan/repay');

      if (!data.requiresSignature || !data.transactions) {
        setTxStep(6);
        setSuccess(data);
        return;
      }

      const txs = data.transactions as Array<{ type: string; unsignedXdr: string }>;
      const approveTx = txs.find((t) => t.type === 'approve');

      if (!approveTx) {
        throw new Error('Approval transaction not generated correctly.');
      }

      setTxStep(2);
      const approveResult = await signTx(approveTx.unsignedXdr, user.wallet);
      if ('error' in approveResult) {
        throw new Error(`APPROVAL_SIGN:${approveResult.error}`);
      }

      setTxStep(3);
      await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [approveResult.signedXdr],
        flow: { action: 'repay', step: 'approve' },
      });

      // Fetch a freshly-sequenced repay XDR (account seq is now N+1)
      setTxStep(4);
      const { data: repayXdrData } = await api.post('/loan/repay-xdr');
      const repayUnsignedXdr = repayXdrData.unsignedXdr;

      const repayResult = await signTx(repayUnsignedXdr, user.wallet);
      if ('error' in repayResult) {
        throw new Error(`REPAY_SIGN:${repayResult.error}`);
      }

      setTxStep(5);
      const finalResult = await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [repayResult.signedXdr],
        flow: { action: 'repay', step: 'repay' },
      });

      setTxStep(6);
      setSuccess(finalResult.data);

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.score(user?.wallet ?? '') });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanStatus(user?.wallet ?? '') });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pool });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Repayment failed. Please try again.');

      if (errorMessage.startsWith('APPROVAL_SIGN:')) {
        setError('Approval signing cancelled.');
        setTxStep(0);
        return;
      }

      if (errorMessage.startsWith('REPAY_SIGN:')) {
        setError('Repayment signing cancelled. Your PHPC approval is still valid — click Repay again to continue.');
        setTxStep(4);
        return;
      }

      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response: { status: number; data: { error: string; shortfall: string } } }).response;
         if (resp?.status === 422 && resp?.data?.error === 'InsufficientBalance') {
          setError(`Insufficient balance. Shortfall: P${resp.data.shortfall}`);
          setTxStep(0);
          setLoading(false);
          return;
        }
        if (resp?.status === 400 && resp?.data?.error === 'This loan has been defaulted and cannot be repaid') {
          setError('This loan has been defaulted.');
          window.setTimeout(() => router.replace('/dashboard'), 3000);
          setTxStep(0);
          return;
        }
      }
      setError(errorMessage);
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
              <div className="rounded-xl px-4 py-2 text-sm font-bold shadow-lg" style={{ background: tierGradient(success.newTierNumeric), color: '#020617' }}>
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
        <StepBreadcrumb step={3} total={4} />
        <h1 className="mt-2 text-2xl font-extrabold lg:text-3xl">Active Loan</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Timely repayment feeds into the next metrics refresh and upgrades your Credit Passport.
        </p>
      </div>

      <WalletConnectionBanner />

      <div className="card-elevated animate-fade-up">
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--color-bg-card)' }}>
          <SummaryRow label="Principal" value={`P${status?.loan?.principal ?? '0.00'}`} />
          <SummaryRow label="Fee owed" value={`P${status?.loan?.fee ?? '0.00'}`} />
          <SummaryRow label="Total due" value={`P${status?.loan?.totalOwed ?? '0.00'}`} strong />
          <SummaryRow label="Wallet PHPC" value={`P${status?.loan?.walletBalance ?? '0.00'}`} />
          {status?.loan?.shortfall && status.loan.shortfall !== '0.00' ? (
            <SummaryRow label="Still needed" value={`P${status.loan.shortfall}`} tone="danger" />
          ) : null}
          <SummaryRow label="Due date" value={status?.loan?.dueDate ? new Date(status.loan.dueDate).toLocaleDateString() : '-'} />
          <SummaryRow
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
              <TransactionStepper currentStep={txStep} />
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
                {getTransactionStepLabel(txStep)}
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

function getTransactionStepLabel(step: number) {
  switch (step) {
    case 1:
      return 'Preparing repayment...';
    case 2:
      return 'Sign approval in Freighter...';
    case 3:
      return 'Submitting approval...';
    case 4:
      return 'Sign repayment in Freighter...';
    case 5:
      return 'Submitting repayment...';
    case 6:
      return 'Confirming settlement...';
    default:
      return 'Processing...';
  }
}

function TransactionStepper({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Preparing', id: 1 },
    { label: 'Sign Approval', id: 2 },
    { label: 'Submit Approval', id: 3 },
    { label: 'Sign Repayment', id: 4 },
    { label: 'Submit Repayment', id: 5 },
    { label: 'Confirm', id: 6 },
  ];

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-center text-slate-300">
        {getTransactionStepLabel(currentStep)}
      </div>
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
