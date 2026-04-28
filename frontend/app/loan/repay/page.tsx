'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface LoanStatusResponse {
  loan: null | {
    principal: string;
    fee: string;
    totalOwed: string;
  };
}

interface RepaySuccess {
  updatedScore: null | {
    score: number;
    tierLabel: string;
    borrowLimit: number;
  };
}

function tierGradient(tierLabel: string) {
  switch (tierLabel) {
    case 'Gold': return 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)';
    case 'Silver': return 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)';
    case 'Bronze': return 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)';
    default: return 'linear-gradient(135deg, #475569 0%, #64748B 100%)';
  }
}

export default function RepayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<RepaySuccess | null>(null);
  const [error, setError] = useState('');

  const { data: status } = useQuery({
    queryKey: ['loan-status'],
    queryFn: () => api.get<LoanStatusResponse>('/loan/status').then((res) => res.data),
  });

  const handleRepay = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/loan/repay');
      setSuccess(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Repayment failed. Please try again.'));
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

            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
              Step 4
            </p>
            <h1 className="mt-2 text-3xl font-extrabold">Repaid on time</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              The loan is closed and your Credit Passport can now unlock a stronger tier.
            </p>
          </div>

          {/* Updated Score Card */}
          <div
            className="mt-8 rounded-xl p-5 text-left"
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-2" style={{ color: 'var(--color-accent)' }}>
              <TrendingUp size={16} />
              <p className="text-sm font-semibold">Live score result</p>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Updated score</p>
                <p className="text-5xl font-extrabold tabular-nums">
                  {success.updatedScore?.score ?? '--'}
                </p>
              </div>
              <div
                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{
                  background: tierGradient(success.updatedScore?.tierLabel || 'Unrated'),
                  color: '#020617',
                }}
              >
                {success.updatedScore?.tierLabel || 'Refreshing'}
              </div>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Borrow limit now:{' '}
              <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                ₱{Number(success.updatedScore?.borrowLimit || 0).toLocaleString()}
              </span>
            </p>
          </div>

          <button
            id="btn-to-dashboard"
            onClick={() => router.push('/dashboard')}
            className="btn-primary btn-accent mt-8 cursor-pointer"
          >
            See refreshed dashboard
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ─── Default View ─── */
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Repay and raise the score</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Timely repayment feeds into the next metrics refresh and upgrades the Credit Passport.
        </p>
      </div>

      <div className="card-elevated animate-fade-up" style={{ animationDelay: '50ms' }}>
        {/* Loan Details */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--color-bg-card)' }}
        >
          <Row label="Principal" value={`₱${status?.loan?.principal ?? '0.00'}`} />
          <Row label="Fee" value={`₱${status?.loan?.fee ?? '0.00'}`} />
          <Row label="Total due" value={`₱${status?.loan?.totalOwed ?? '0.00'}`} strong />
        </div>

        {/* Error */}
        {error && (
          <div
            className="mt-4 rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          id="btn-repay-confirm"
          onClick={handleRepay}
          disabled={loading}
          className="btn-primary btn-accent mt-6 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting repayment…
            </>
          ) : (
            `Repay ₱${status?.loan?.totalOwed ?? '0.00'}`
          )}
        </button>
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
      style={
        strong
          ? { borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }
          : { color: 'var(--color-text-secondary)' }
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
