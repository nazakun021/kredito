'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

export default function Page() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enterDemo = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/demo');
      setAuth(data.token, data.user);
      await api.post('/credit/generate');
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to start the demo.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(235,94,40,0.16),_transparent_36%),linear-gradient(180deg,_#fff8ef_0%,_#fffdf8_52%,_#f7efe2_100%)] px-6 py-8 text-stone-900">
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_rgba(116,69,21,0.14)] backdrop-blur">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-700">Kredito</p>
            <h1 className="mt-3 text-4xl font-black leading-none">Credit in under a minute.</h1>
          </div>
          <div className="rounded-full bg-orange-100 p-3 text-orange-700">
            <Sparkles size={24} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1.6rem] bg-stone-950 p-5 text-stone-50">
          <p className="text-sm uppercase tracking-[0.28em] text-orange-300">Demo promise</p>
          <p className="text-2xl font-semibold leading-tight">
            Generate an on-chain score, unlock a loan, repay it, and watch the passport improve live.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          {[
            { icon: Wallet, title: 'Silent wallet setup', copy: 'Demo wallet is created and ready without signup friction.' },
            { icon: ShieldCheck, title: 'Fully visible scoring', copy: 'Every metric and formula input is shown before you borrow.' },
            { icon: Sparkles, title: 'Progressive unlock', copy: 'Repayment upgrades your score, tier, and available limit.' },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-[1.4rem] border border-stone-200 bg-white px-4 py-4">
              <div className="mb-2 inline-flex rounded-full bg-stone-100 p-2 text-stone-700">
                <Icon size={18} />
              </div>
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm text-stone-600">{copy}</p>
            </div>
          ))}
        </div>

        {error ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}

        <button
          onClick={enterDemo}
          disabled={loading}
          className="mt-8 w-full rounded-[1.4rem] bg-orange-600 px-5 py-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(234,88,12,0.28)] transition hover:bg-orange-500 disabled:opacity-50"
        >
          {loading ? 'Starting demo...' : 'Generate Score'}
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
