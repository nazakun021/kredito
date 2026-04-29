'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TimerReset } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { REQUIRED_NETWORK } from '@/lib/constants';

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
  const [success, setSuccess] = useState<BorrowSuccess | null>(null);
  const [error, setError] = useState('');

  const { isConnected: walletConnected, network, connectionError: walletError } = useWalletStore();
  const isCorrectNetwork = network === REQUIRED_NETWORK;
  const canBorrow = walletConnected && isCorrectNetwork;

  const { data: score } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
    enabled: !!user,
  });

  const { data: loanStatus } = useQuery({
    queryKey: ['loan-status'],
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }

    if (loanStatus?.hasActiveLoan) {
      router.replace('/loan/repay');
    }
  }, [loanStatus?.hasActiveLoan, router, user]);

  const borrowAmount = Number(score?.borrowLimit || 0);
  const fee = borrowAmount * ((score?.feeBps || 0) / 10_000);

  const handleBorrow = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('loan/borrow', { amount: borrowAmount });
      setSuccess(data);
      await queryClient.invalidateQueries({ queryKey: ['loan-status'] });
      await queryClient.invalidateQueries({ queryKey: ['pool'] });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Borrowing failed. Please try again.'));
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

          <a href={success.explorerUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex text-sm" style={{ color: 'var(--color-accent)' }}>
            View on Stellar Expert
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
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
          Step 3
        </p>
        <h1 className="mt-2 text-2xl font-extrabold lg:text-3xl">Borrow from the pool</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Eligibility is enforced by the on-chain tier stored in your Credit Passport.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-elevated animate-fade-up">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
            Approved amount
          </p>
          <p className="mt-4 text-5xl font-extrabold tabular-nums">P{borrowAmount.toFixed(2)}</p>
          <div className="mt-6" style={{ color: 'var(--color-text-secondary)' }}>
            <Row label="Tier" value={score?.tierLabel || 'Unrated'} />
            <Row label="Fee" value={`${(score?.feeRate || 0).toFixed(2)}%`} />
            <Row label="Term" value="30 days" />
            <Row label="Repayment" value={`P${(borrowAmount + fee).toFixed(2)}`} strong />
          </div>
        </div>

        <div className="flex flex-col gap-4 animate-fade-up">
          <div className="flex gap-3 rounded-xl p-4 text-sm" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-amber)' }}>
            <TimerReset className="mt-0.5 shrink-0" size={16} />
            <p>Repay before the due ledger to protect your score. Timely repayment improves the next score refresh.</p>
          </div>

          <label
            className="flex cursor-pointer items-start gap-3 rounded-xl p-4 text-sm transition-colors"
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
            <span>I understand the terms and want to trigger the live borrowing transaction.</span>
          </label>

          {error || (walletConnected && !isCorrectNetwork ? walletError : null) ? (
            <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }} role="alert">
              {error || walletError}
            </div>
          ) : null}

          <button 
            onClick={handleBorrow} 
            disabled={!agreed || loading || borrowAmount <= 0 || score?.tier === 0 || !canBorrow} 
            className="btn-primary btn-accent mt-auto disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting to Stellar...
              </>
            ) : (
              <>
                Confirm Borrow
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${strong ? 'mt-3 border-t pt-3 font-bold' : 'mt-2'}`}
      style={strong ? { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' } : {}}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
