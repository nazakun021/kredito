'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { REQUIRED_NETWORK } from '@/lib/constants';

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

function tierGradient(tierLabel: string) {
  switch (tierLabel) {
    case 'Gold':
      return 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)';
    case 'Silver':
      return 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)';
    case 'Bronze':
      return 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)';
    default:
      return 'linear-gradient(135deg, #475569 0%, #64748B 100%)';
  }
}

export default function RepayPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<RepaySuccess | null>(null);
  const [error, setError] = useState('');

  const { isConnected: walletConnected, network, connectionError: walletError } = useWalletStore();
  const isCorrectNetwork = network === REQUIRED_NETWORK;
  const canRepay = walletConnected && isCorrectNetwork;

  const { data: status } = useQuery({
    queryKey: ['loan-status'],
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }

    if (status && !status.hasActiveLoan) {
      router.replace('/dashboard');
    }
  }, [router, status, user]);

  const handleRepay = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('loan/repay');
      setSuccess(data);
      await queryClient.invalidateQueries({ queryKey: ['score'] });
      await queryClient.invalidateQueries({ queryKey: ['score-generate'] });
      await queryClient.invalidateQueries({ queryKey: ['loan-status'] });
      await queryClient.invalidateQueries({ queryKey: ['pool'] });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Repayment failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
        <div className="card-elevated w-full animate-fade-up">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
            </div>

            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
              Step 4
            </p>
            <h1 className="mt-2 text-3xl font-extrabold">Repaid on time</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              The loan is closed and your Credit Passport can now unlock a stronger tier.
            </p>
          </div>

          <div className="mt-8 rounded-xl p-5 text-left" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
              <TrendingUp size={16} />
              <p className="text-sm font-semibold">Live score result</p>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Updated score</p>
                <p className="text-5xl font-extrabold tabular-nums">{success.newScore}</p>
              </div>
              <div className="rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: tierGradient(success.newTier), color: '#020617' }}>
                {success.newTier}
              </div>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {success.previousScore !== null ? `Score: ${success.previousScore} -> ${success.newScore}` : 'Score refreshed on-chain'}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Borrow limit now: <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>P{success.newBorrowLimit}</span>
            </p>
          </div>

          <a href={success.explorerUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex text-sm" style={{ color: 'var(--color-accent)' }}>
            View on Stellar Expert
          </a>

          <button onClick={() => router.push('/dashboard')} className="btn-primary btn-accent mt-8">
            Back to Passport
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Active Loan</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Timely repayment feeds into the next metrics refresh and upgrades the Credit Passport.
        </p>
      </div>

      <div className="card-elevated animate-fade-up">
        <div className="rounded-xl p-5" style={{ background: 'var(--color-bg-card)' }}>
          <Row label="Principal" value={`P${status?.loan?.principal ?? '0.00'}`} />
          <Row label="Fee owed" value={`P${status?.loan?.fee ?? '0.00'}`} />
          <Row label="Total due" value={`P${status?.loan?.totalOwed ?? '0.00'}`} strong />
          <Row label="Wallet PHPC" value={`P${status?.loan?.walletBalance ?? status?.walletPhpBalance ?? '0.00'}`} />
          {status?.loan?.shortfall && status.loan.shortfall !== '0.00' ? (
            <Row label="Still needed" value={`P${status.loan.shortfall}`} tone="danger" />
          ) : null}
          <Row label="Due date" value={status?.loan?.dueDate ? new Date(status.loan.dueDate).toLocaleDateString() : '-'} />
          <Row
            label="Days remaining"
            value={status?.loan ? `${status.loan.daysRemaining}` : '-'}
            tone={status?.loan ? (status.loan.daysRemaining <= 0 ? 'danger' : status.loan.daysRemaining <= 7 ? 'amber' : 'success') : undefined}
          />
        </div>

        {status?.loan?.shortfall && status.loan.shortfall !== '0.00' ? (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-amber)' }}>
            Repayment pulls funds from your connected wallet. You borrowed only the principal, so the fee is not auto-funded. Add at least P{status.loan.shortfall} PHPC to this wallet before repaying.
          </div>
        ) : null}

        {error || (walletConnected && !isCorrectNetwork ? walletError : null) ? (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} role="alert">
            {error || walletError}
          </div>
        ) : null}

        <button 
          onClick={handleRepay} 
          disabled={loading || !canRepay} 
          className="btn-primary btn-accent mt-6 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Processing repayment...
            </>
          ) : (
            `Repay P${status?.loan?.totalOwed ?? '0.00'}`
          )}
        </button>
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
      className={`flex items-center justify-between text-sm ${strong ? 'mt-3 border-t pt-3 font-bold' : 'mt-2'}`}
      style={strong ? { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' } : { color: 'var(--color-text-secondary)' }}
    >
      <span>{label}</span>
      <span className="tabular-nums" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
