'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, TimerReset } from 'lucide-react';
import api from '../../../lib/api';

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
      setError(getErrorMessage(err, 'Borrowing failed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,_#fdf8ef_0%,_#fff_42%,_#f3ebe0_100%)] px-5 py-8 text-center">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_rgba(28,25,23,0.08)]">
          <div className="mx-auto mb-5 inline-flex rounded-full bg-green-100 p-4 text-green-700">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-3xl font-black text-stone-900">Funds released</h1>
          <p className="mt-2 text-stone-500">Your demo wallet received the loan instantly from the on-chain pool.</p>

          <div className="mt-6 rounded-[1.4rem] bg-stone-50 p-5 text-left">
            <Row label="Amount" value={`₱${success.amount}`} />
            <Row label={`Fee (${(success.feeBps / 100).toFixed(2)}%)`} value={`₱${success.fee}`} />
            <Row label="Total owed" value={`₱${success.totalOwed}`} strong />
          </div>

          <button
            onClick={() => router.push('/loan/repay')}
            className="mt-6 w-full rounded-[1.3rem] bg-stone-950 px-5 py-4 font-bold text-white"
          >
            Continue to Repay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#fdf8ef_0%,_#fff_42%,_#f3ebe0_100%)] px-5 py-8">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-2 text-sm font-bold text-stone-700">
        <ArrowLeft size={18} /> Back
      </button>

      <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_rgba(28,25,23,0.08)]">
        <p className="text-xs uppercase tracking-[0.3em] text-orange-700">Screen 3</p>
        <h1 className="mt-3 text-3xl font-black text-stone-900">Borrow instantly</h1>
        <p className="mt-2 text-stone-500">Eligibility is enforced by the on-chain score and tier stored in your Credit Passport.</p>

        <div className="mt-6 rounded-[1.6rem] bg-stone-950 p-5 text-stone-50">
          <p className="text-sm uppercase tracking-[0.24em] text-orange-200">Approved amount</p>
          <p className="mt-3 text-4xl font-black">₱{borrowAmount.toLocaleString()}</p>
          <div className="mt-4 text-sm text-stone-300">
            <Row label="Tier" value={score?.tierLabel || 'Unrated'} />
            <Row label="Fee" value={`${((score?.feeBps || 0) / 100).toFixed(2)}%`} />
            <Row label="Repayment" value={`₱${(borrowAmount + fee).toFixed(2)}`} strong />
          </div>
        </div>

        <div className="mt-5 flex gap-3 rounded-[1.3rem] bg-orange-50 p-4 text-sm text-orange-900">
          <TimerReset className="mt-0.5 shrink-0" size={18} />
          <p>Repay before the due ledger to protect your score. Timely repayment boosts your next score refresh.</p>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-[1.3rem] bg-stone-50 p-4 text-sm text-stone-700">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>I understand the terms and want to trigger the live borrowing transaction.</span>
        </label>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          onClick={handleBorrow}
          disabled={!agreed || loading || borrowAmount <= 0}
          className="mt-6 w-full rounded-[1.3rem] bg-orange-600 px-5 py-4 font-bold text-white disabled:opacity-40"
        >
          {loading ? 'Submitting borrow...' : `Borrow ₱${borrowAmount.toLocaleString()}`}
        </button>
      </div>
    </div>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
  ) {
    return (err as { response?: { data?: { error?: string } } }).response?.data?.error as string;
  }
  return fallback;
}

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
    <div className={`flex items-center justify-between ${strong ? 'mt-3 border-t border-white/10 pt-3 font-bold' : 'mt-2'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
