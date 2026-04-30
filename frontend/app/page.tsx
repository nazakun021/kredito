'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { loginWithFreighter, waitForFreighter } from '@/lib/freighter';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import NetworkBadge from '@/components/NetworkBadge';
import { toast } from 'sonner';

export default function Page() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const user = useAuthStore((state) => state.user);
  const { connectionError: walletError } = useWalletStore();
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState('');
  const [freighterReady, setFreighterReady] = useState(false);
  const [checkingFreighter, setCheckingFreighter] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 1. Auto-redirect if already authenticated
    if (user) {
      router.push('/dashboard');
      return;
    }

    void (async () => {
      // 2. Wait for Freighter injection
      const installed = await waitForFreighter();
      if (!cancelled) {
        setFreighterReady(installed);
        setCheckingFreighter(false);
      }

    })();

    return () => {
      cancelled = true;
    };
  }, [router, user]);

  const connectWallet = async () => {
    setWalletLoading(true);
    setError('');

    try {
      // Perform backend login (SEP-10 challenge)
      const data = await loginWithFreighter();

      if (data) {
        useWalletStore.setState({ isConnected: true, publicKey: data.wallet });
        setAuth({ wallet: data.wallet, isExternal: data.isExternal });
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      // Surface the specific error message (e.g. "Freighter not found", "User rejected", etc)
      const msg = getErrorMessage(err, 'Unable to connect to Freighter.');
      setError(msg);
      
      // If it's a "not found" error, update the state so the "Get Extension" button shows up
      if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('install')) {
        setFreighterReady(false);
      }
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <Suspense fallback={null}>
        <SessionExpiredToast setError={setError} />
      </Suspense>
      {/* ─── Background Glows ─── */}
      <div
        className="pointer-events-none fixed left-0 top-0"
        style={{
          width: 800,
          height: 800,
          background: 'radial-gradient(circle at 30% 20%, rgba(34,197,94,0.08) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed right-0 top-1/3"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(2, 6, 23, 0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'var(--color-border)',
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
            <span className="text-lg font-bold tracking-tight">Kredito</span>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium sm:flex" style={{ color: 'var(--color-text-muted)' }}>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
          </div>

          <div className="flex items-center gap-4">
            <NetworkBadge />
            <ConnectWalletButton />
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex min-h-[calc(100dvh-10rem)] flex-col justify-center gap-12 py-16 lg:flex-row lg:items-center lg:gap-20">
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
              Built on Stellar · Testnet Edition
            </div>

            <h1 className="mt-8 text-5xl font-extrabold leading-[1.1] tracking-tight lg:text-7xl">
              Connect your wallet.
              <br />
              <span style={{ color: 'var(--color-accent)' }}>Borrow with proof.</span>
            </h1>

            <p className="mt-8 text-lg leading-relaxed lg:max-w-lg" style={{ color: 'var(--color-text-secondary)' }}>
              Sign in with Freighter, score your Stellar address on-chain, and unlock a transparent micro-loan flow without a separate account system.
            </p>

            {error || walletError ? (
              <div
                className="mt-8 max-w-md rounded-xl px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                role="alert"
              >
                {error || walletError}
              </div>
            ) : null}

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              {user ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl px-8 text-base font-bold transition-all sm:w-auto"
                  style={{
                    background: 'var(--color-accent)',
                    color: '#020617',
                    boxShadow: '0 12px 40px rgba(34,197,94,0.25)',
                  }}
                >
                  <TrendingUp size={20} />
                  Go to Dashboard
                  <ArrowRight size={20} />
                </button>
              ) : freighterReady || checkingFreighter ? (
                <button
                  onClick={connectWallet}
                  disabled={walletLoading}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl px-8 text-base font-bold transition-all sm:w-auto"
                  style={{
                    background: 'var(--color-accent)',
                    color: '#020617',
                    boxShadow: '0 12px 40px rgba(34,197,94,0.25)',
                  }}
                >
                  {walletLoading ? <Loader2 size={20} className="animate-spin" /> : <Link2 size={20} />}
                  {walletLoading ? 'Connecting to Freighter...' : 'Connect Freighter Wallet'}
                  {!walletLoading && <ArrowRight size={20} />}
                </button>
              ) : (
                <a
                  href="https://freighter.app"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border px-8 text-base font-bold transition-all sm:w-auto hover:bg-slate-800"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
                >
                  <Link2 size={20} />
                  Get Freighter Extension
                </a>
              )}

              {(!freighterReady && !checkingFreighter) && (
                <button 
                  onClick={() => { setCheckingFreighter(true); waitForFreighter().then(setFreighterReady).finally(() => setCheckingFreighter(false)); }}
                  className="text-sm text-slate-500 underline hover:text-slate-300 transition-colors"
                >
                  Just installed? Click here to refresh.
                </button>
              )}
            </div>

            <p className="mt-6 text-sm flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
              <ShieldCheck size={14} className="text-emerald-500" />
              Secure SEP-10 authentication. Your private key never leaves your browser.
            </p>
          </div>

          {/* ─── Hero Visual (Score Preview) ─── */}
          <div className="w-full max-w-sm lg:max-w-none lg:flex-1 animate-fade-up" style={{ animationDelay: '150ms' }}>
            <div
              className="rounded-3xl p-8 animate-pulse"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-elevated)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase opacity-50">
                    Credit Passport
                  </p>
                  <p className="mt-2 text-6xl font-extrabold tabular-nums">84</p>
                </div>
                <div
                  className="rounded-2xl px-5 py-2.5 text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)', color: '#020617' }}
                >
                  Silver Tier
                </div>
              </div>
              
              <div className="mt-8 space-y-4">
                <div className="rounded-2xl p-5" style={{ background: 'rgba(148, 163, 184, 0.04)', border: '1px solid rgba(148, 163, 184, 0.08)' }}>
                  <div className="flex justify-between text-xs font-semibold opacity-60">
                    <span>Progress to Gold</span>
                    <span>36 points left</span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ width: '70%', background: 'linear-gradient(90deg, #94A3B8, #CBD5E1)' }} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Borrow limit', value: 'P20,000' },
                    { label: 'Interest', value: '3.0%' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-2xl p-5 border border-slate-800/50 bg-slate-900/30">
                      <p className="text-[10px] font-bold tracking-widest uppercase opacity-40">{s.label}</p>
                      <p className="mt-1 text-lg font-bold">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-32 lg:px-10">
        <div className="text-center animate-fade-up">
          <p className="text-xs font-bold tracking-widest uppercase text-emerald-500">
            Platform Benefits
          </p>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight lg:text-5xl">How Kredito works</h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
            A transparent credit system where every score is verifiable on-chain and every loan is settled through smart contracts.
          </p>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: 'Seamless wallet sign-in',
              copy: 'Freighter opens inline so access approval and secure wallet login happen in one smooth flow.',
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
              title: 'Portable credit identity',
              copy: 'Your wallet address becomes your on-chain credit identity, with no separate account to manage.',
            },
          ].map(({ icon: Icon, title, copy }, i) => (
            <div 
              key={title} 
              className="card-elevated group animate-fade-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 transition-colors group-hover:bg-emerald-500/10">
                <Icon size={20} className="text-emerald-500" />
              </div>
              <h3 className="mt-6 text-xl font-bold">{title}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-400">
                {copy}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SessionExpiredToast({ setError }: { setError: (value: string) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('session') !== 'expired') {
      return;
    }

    const message = 'Session expired. Please connect again.';
    setError(message);
    toast.error(message);
    router.replace('/');
  }, [router, searchParams, setError]);

  return null;
}
