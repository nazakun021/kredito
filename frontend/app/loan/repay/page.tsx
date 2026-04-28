'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, TrendingUp } from 'lucide-react';
import api from '../../../lib/api';

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
      setError(getErrorMessage(err, 'Repayment failed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,_#fdf8ef_0%,_#fff_42%,_#f3ebe0_100%)] px-5 py-8">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 text-center shadow-[0_24px_60px_rgba(28,25,23,0.08)]">
          <div className="mx-auto mb-5 inline-flex rounded-full bg-green-100 p-4 text-green-700">
            <CheckCircle2 size={36} />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-orange-700">Screen 4</p>
          <h1 className="mt-3 text-3xl font-black text-stone-900">Repaid on time</h1>
          <p className="mt-2 text-stone-500">The loan is closed and your Credit Passport can now unlock a stronger tier.</p>

          <div className="mt-6 rounded-[1.5rem] bg-stone-950 p-5 text-left text-stone-50">
            <div className="flex items-center gap-3 text-orange-200">
              <TrendingUp size={18} />
              <p className="font-semibold">Live score result</p>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-sm text-stone-300">Updated score</p>
                <p className="text-4xl font-black">{success.updatedScore?.score ?? '--'}</p>
              </div>
              <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
                {success.updatedScore?.tierLabel || 'Refreshing'}
              </div>
            </div>
            <p className="mt-4 text-sm text-stone-300">
              Borrow limit now: ₱{Number(success.updatedScore?.borrowLimit || 0).toLocaleString()}
            </p>
          </div>

          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 w-full rounded-[1.3rem] bg-orange-600 px-5 py-4 font-bold text-white"
          >
            See refreshed dashboard
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
        <h1 className="text-3xl font-black text-stone-900">Repay and raise the score</h1>
        <p className="mt-2 text-stone-500">Timely repayment feeds back into the next metrics refresh and upgrades the Credit Passport.</p>

        <div className="mt-6 rounded-[1.5rem] bg-stone-50 p-5">
          <Row label="Principal" value={`₱${status?.loan?.principal ?? '0.00'}`} />
          <Row label="Fee" value={`₱${status?.loan?.fee ?? '0.00'}`} />
          <Row label="Total due" value={`₱${status?.loan?.totalOwed ?? '0.00'}`} strong />
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          onClick={handleRepay}
          disabled={loading}
          className="mt-6 w-full rounded-[1.3rem] bg-stone-950 px-5 py-4 font-bold text-white disabled:opacity-50"
        >
          {loading ? 'Submitting repayment...' : `Repay ₱${status?.loan?.totalOwed ?? '0.00'}`}
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
    <div className={`flex items-center justify-between ${strong ? 'mt-3 border-t border-stone-200 pt-3 font-bold text-stone-900' : 'mt-2 text-stone-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
