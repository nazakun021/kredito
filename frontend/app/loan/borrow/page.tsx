'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TimerReset } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface ScoreResponse {
  tierLabel: string;
  borrowLimit: number;
  feeBps: number;
}

interface BorrowSuccess {
  amount: string;
  fee: string;
  feeBps: number;
  totalOwed: string;
}

export default function BorrowPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<BorrowSuccess | null>(null);
  const [error, setError] = useState('');

  const { data: score } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get<ScoreResponse>('/credit/score').then((res) => res.data),
  });

  const borrowAmount = Number(score?.borrowLimit || 0);
  const fee = borrowAmount * ((score?.feeBps || 0) / 10_000);

  const handleBorrow = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/loan/borrow', { amount: borrowAmount });
      setSuccess(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Borrowing failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  /* ─── Success View ─── */
  if (success) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center">
        <div className="card-elevated w-full animate-fade-up">
          <div className="flex flex-col items-center">
            <div
              className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: 'var(--color-success-bg)' }}
            >
              <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} />
            </div>
            <h1 className="text-3xl font-extrabold">Funds released</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your demo wallet received the loan instantly from the on-chain pool.
            </p>
          </div>

          <div
            className="mt-8 rounded-xl p-5 text-left"
            style={{ background: 'var(--color-bg-card)' }}
          >
            <Row label="Amount" value={`₱${success.amount}`} />
            <Row label={`Fee (${(success.feeBps / 100).toFixed(2)}%)`} value={`₱${success.fee}`} />
            <Row label="Total owed" value={`₱${success.totalOwed}`} strong />
          </div>

          <button
            id="btn-continue-repay"
            onClick={() => router.push('/loan/repay')}
            className="btn-primary btn-accent mt-8 cursor-pointer"
          >
            Continue to Repay
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ─── Default View ─── */
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 animate-fade-up">
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
          Step 3
        </p>
        <h1 className="mt-2 text-2xl font-extrabold lg:text-3xl">Borrow instantly</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Eligibility enforced by the on-chain score and tier stored in your Credit Passport.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ─── Left: Amount Card ─── */}
        <div
          className="card-elevated animate-fade-up"
          style={{ animationDelay: '50ms' }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
            Approved amount
          </p>
          <p className="mt-4 text-5xl font-extrabold tabular-nums">
            ₱{borrowAmount.toLocaleString()}
          </p>
          <div className="mt-6" style={{ color: 'var(--color-text-secondary)' }}>
            <Row label="Tier" value={score?.tierLabel || 'Unrated'} />
            <Row label="Fee" value={`${((score?.feeBps || 0) / 100).toFixed(2)}%`} />
            <Row label="Repayment" value={`₱${(borrowAmount + fee).toFixed(2)}`} strong />
          </div>
        </div>

        {/* ─── Right: Confirm Card ─── */}
        <div className="flex flex-col gap-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
          {/* Notice */}
          <div
            className="flex gap-3 rounded-xl p-4 text-sm"
            style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--color-amber)' }}
          >
            <TimerReset className="mt-0.5 shrink-0" size={16} />
            <p>
              Repay before the due ledger to protect your score. Timely repayment boosts your next score refresh.
            </p>
          </div>

          {/* Agreement */}
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
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>I understand the terms and want to trigger the live borrowing transaction.</span>
          </label>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            id="btn-borrow-confirm"
            onClick={handleBorrow}
            disabled={!agreed || loading || borrowAmount <= 0}
            className="btn-primary btn-accent mt-auto cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting borrow…
              </>
            ) : (
              <>
                Borrow ₱{borrowAmount.toLocaleString()}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Row Component ─── */
function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${
        strong ? 'mt-3 border-t pt-3 font-bold' : 'mt-2'
      }`}
      style={strong ? { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' } : {}}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
