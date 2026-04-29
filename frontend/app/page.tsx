'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  Globe,
  Link2,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import api from '@/lib/api';
import { connectFreighter, isFreighterInstalled } from '@/lib/freighter';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';

export default function Page() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState('');
  const [freighterReady, setFreighterReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isFreighterInstalled()) {
        setFreighterReady(true);
      }

      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('session') === 'expired') {
        setError('Session expired. Start again.');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const enterDemo = async () => {
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/demo');
      setAuth(data.token, { wallet: data.wallet, isExternal: false });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to start the demo. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    setWalletLoading(true);
    setError('');

    try {
      const publicKey = await connectFreighter();
      if (!publicKey) {
        return;
      }

      const { data } = await api.post('/auth/login', { stellarAddress: publicKey });
      setAuth(data.token, { wallet: data.wallet, isExternal: true });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to connect Freighter right now.'));
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <div
        className="pointer-events-none fixed left-0 top-0"
        style={{
          width: 800,
          height: 800,
          background: 'radial-gradient(circle at 30% 20%, rgba(34,197,94,0.06) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed right-0 top-1/3"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(34,197,94,0.04) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <nav
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(2, 6, 23, 0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}
            >
              <ShieldCheck size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <span className="text-base font-bold">Kredito</span>
          </div>

          <div className="hidden items-center gap-6 text-sm font-medium sm:flex" style={{ color: 'var(--color-text-muted)' }}>
            <a href="#features" className="transition-colors hover:text-white cursor-pointer">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white cursor-pointer">How it works</a>
          </div>

          <button
            onClick={enterDemo}
            disabled={loading}
            className="hidden h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold cursor-pointer transition-all sm:flex"
            style={{
              background: 'var(--color-accent)',
              color: '#020617',
              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.25)',
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? 'Generating...' : 'Try Demo'}
          </button>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex min-h-[calc(100dvh-9rem)] flex-col justify-center gap-12 py-16 text-center lg:flex-row lg:items-center lg:text-left lg:gap-20">
          <div className="min-w-0 flex-1 animate-fade-up">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                background: 'var(--color-accent-glow)',
                border: '1px solid var(--color-border-accent)',
                color: 'var(--color-accent)',
              }}
            >
              <Globe size={12} />
              Built on Stellar · Zero Gas Fees
            </div>

            <h1 className="mt-6 text-5xl font-extrabold leading-[1.08] tracking-tight lg:text-6xl">
              Credit in
              <br />
              <span style={{ color: 'var(--color-accent)' }}>under a minute.</span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed lg:max-w-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Transparent on-chain credit scores and instant micro-loans for the unbanked. Generate a score, unlock a loan, and build your Credit Passport.
            </p>

            {error ? (
              <div
                className="mx-auto mt-6 max-w-md rounded-xl px-4 py-3 text-sm font-medium lg:mx-0"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <button
                onClick={enterDemo}
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl px-8 text-base font-bold cursor-pointer transition-all sm:w-auto"
                style={{
                  background: 'var(--color-accent)',
                  color: '#020617',
                  boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Score
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 flex w-full max-w-sm flex-col gap-3 lg:max-w-none lg:items-start">
              <div className="flex w-full items-center gap-3 text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-muted)' }}>
                <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                or
                <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
              </div>

              {freighterReady ? (
                <button
                  onClick={connectWallet}
                  disabled={walletLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition-colors sm:w-auto"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                >
                  {walletLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                  {walletLoading ? 'Connecting...' : 'Connect Freighter Wallet'}
                </button>
              ) : (
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 text-sm font-semibold transition-colors sm:w-auto"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                >
                  <Link2 size={14} />
                  Get Freighter
                </a>
              )}

              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Stellar Testnet · No real money
              </p>
            </div>
          </div>

          <div className="w-full max-w-sm min-w-0 lg:max-w-none lg:flex-1 animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-elevated)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                    Demo Preview
                  </p>
                  <p className="mt-2 text-5xl font-extrabold tabular-nums">84</p>
                </div>
                <div
                  className="rounded-xl px-4 py-2 text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)', color: '#020617' }}
                >
                  Silver
                </div>
              </div>
              <div className="mt-5 rounded-xl p-4" style={{ background: 'rgba(148, 163, 184, 0.06)' }}>
                <div className="flex justify-between text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  <span>Progress to Gold</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>36 pts</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-bg-elevated)' }}>
                  <div className="h-2 rounded-full" style={{ width: '70%', background: 'linear-gradient(90deg, #94A3B8, #CBD5E1)' }} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Borrow limit', value: 'P20,000' },
                  { label: 'Fee rate', value: '3.00%' },
                  { label: 'Transactions', value: '12' },
                  { label: 'Repayments', value: '2' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg p-3" style={{ background: 'var(--color-bg-card)' }}>
                    <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                      {s.label}
                    </p>
                    <p className="mt-1 text-sm font-bold tabular-nums">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
        <div className="text-center animate-fade-up">
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
            Features
          </p>
          <h2 className="mt-3 text-3xl font-extrabold">How Kredito works</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            A transparent credit system where every score is verifiable on-chain and every loan is settled through smart contracts.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: 'Silent wallet setup',
              copy: 'Demo wallet is created and funded automatically. No extensions, no signup, no friction.',
            },
            {
              icon: Eye,
              title: 'Fully visible scoring',
              copy: 'Every metric, weight, and formula input is shown transparently before you borrow a single peso.',
            },
            {
              icon: TrendingUp,
              title: 'Progressive unlock',
              copy: 'Repayment upgrades your score, tier, and available limit. Build your credit passport over time.',
            },
            {
              icon: Sparkles,
              title: 'Gasless UX',
              copy: 'Issuer-sponsored fee-bumps keep the user flow smooth even while the contracts settle on Stellar.',
            },
            {
              icon: Zap,
              title: 'Instant disbursement',
              copy: 'Borrowing and repayment happen against the live testnet pool with visible transaction hashes.',
            },
            {
              icon: Globe,
              title: 'Freighter option',
              copy: 'Existing Stellar users can connect a wallet and score their real address instead of a generated demo one.',
            },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="card-elevated animate-fade-up">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--color-bg-card)' }}>
                <Icon size={18} style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                {copy}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
