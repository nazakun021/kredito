'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Sparkles,
  Wallet,
  ArrowRight,
  Loader2,
  Zap,
  Eye,
  TrendingUp,
  Globe,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { getErrorMessage } from '@/lib/errors';

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
      setError(getErrorMessage(err, 'Unable to start the demo. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh">
      {/* ─── Ambient glow (top-left) ─── */}
      <div
        className="pointer-events-none fixed left-0 top-0"
        style={{
          width: 800,
          height: 800,
          background: 'radial-gradient(circle at 30% 20%, rgba(34,197,94,0.06) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />
      {/* ─── Ambient glow (right) ─── */}
      <div
        className="pointer-events-none fixed right-0 top-1/3"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(34,197,94,0.04) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* ─── Navbar ─── */}
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
            {loading ? 'Starting…' : 'Try Demo'}
          </button>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex min-h-[calc(100dvh-9rem)] flex-col justify-center gap-12 py-16 text-center lg:flex-row lg:items-center lg:text-left lg:gap-20">
          {/* Left: Copy */}
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

            {error && (
              <div
                className="mx-auto mt-6 max-w-md rounded-xl px-4 py-3 text-sm font-medium lg:mx-0"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <button
                id="cta-generate-score"
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
                    Starting demo…
                  </>
                ) : (
                  <>
                    Generate Score
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Stellar Testnet · No real money
              </p>
            </div>
          </div>

          {/* Right: Stats preview */}
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
              <div
                className="mt-5 rounded-xl p-4"
                style={{ background: 'rgba(148, 163, 184, 0.06)' }}
              >
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
                  { label: 'Borrow limit', value: '₱20,000' },
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

      {/* ─── Features Grid ─── */}
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
              icon: Zap,
              title: 'Instant settlement',
              copy: 'Loan disbursement and repayment happen in real time through Soroban smart contracts on Stellar.',
            },
            {
              icon: ShieldCheck,
              title: 'Gasless transactions',
              copy: 'All contract calls are fee-bumped by the platform. Users never pay transaction fees.',
            },
            {
              icon: Sparkles,
              title: 'On-chain verification',
              copy: 'Anyone can recompute any score from the same inputs. The formula is public and deterministic.',
            },
          ].map(({ icon: Icon, title, copy }) => (
            <div
              key={title}
              className="card group transition-all hover:border-[rgba(148,163,184,0.2)]"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
                style={{ background: 'var(--color-bg-elevated)' }}
              >
                <Icon size={18} style={{ color: 'var(--color-text-secondary)' }} />
              </div>
              <h3 className="mt-4 text-sm font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it Works ─── */}
      <section id="how-it-works" className="border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-10">
          <div className="text-center animate-fade-up">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
              Demo Flow
            </p>
            <h2 className="mt-3 text-3xl font-extrabold">Four steps to a Credit Passport</h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '01', title: 'Generate Score', desc: 'We create a wallet, mint test PHPC, and compute your on-chain credit score.' },
              { step: '02', title: 'Review Passport', desc: 'See every metric, weight, tier, and the exact formula that computed your score.' },
              { step: '03', title: 'Borrow Instantly', desc: 'Take a micro-loan from the pool. Amount and fee are determined by your tier.' },
              { step: '04', title: 'Repay & Level Up', desc: 'Repay the loan to boost your score and unlock higher tiers and larger limits.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="animate-fade-up">
                <p className="text-3xl font-extrabold tabular-nums" style={{ color: 'var(--color-accent)', opacity: 0.3 }}>
                  {step}
                </p>
                <h3 className="mt-3 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center lg:px-10">
          <h2 className="text-2xl font-extrabold">Ready to try it?</h2>
          <p className="max-w-md text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Generate your first on-chain credit score in under a minute. No signup, no gas fees, no real money.
          </p>
          <button
            onClick={enterDemo}
            disabled={loading}
            className="flex h-14 items-center gap-2 rounded-xl px-10 text-base font-bold cursor-pointer transition-all"
            style={{
              background: 'var(--color-accent)',
              color: '#020617',
              boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Starting…' : 'Launch Demo'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Kredito · Stellar Testnet</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Demo only · No real money
          </p>
        </div>
      </footer>
    </div>
  );
}
