// frontend/app/kyc/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { QUERY_KEYS } from '@/lib/queryKeys';
import CelebrationParticles from '@/components/CelebrationParticles';
import { toast } from 'sonner';

export default function KycPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!user;

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    idType: 'National ID',
    idNumber: '',
    consent: false,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: score, isLoading: isScoreLoading } = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: () => api.get('/credit/score').then((res) => res.data),
    enabled: isAuthenticated,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.consent) return;

    setLoading(true);
    try {
      await api.post('/credit/kyc-submit', formData);
      setSuccess(true);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.score(user?.wallet ?? '') });
      toast.success('KYC Verification Successful!');
    } catch {
      toast.error('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isScoreLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (score?.kycVerified || success) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-12 text-center relative">
        <CelebrationParticles />
        <div className="card-elevated w-full animate-fade-up">
          <div className="flex flex-col items-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-success-bg)' }}>
              <ShieldCheck size={32} style={{ color: 'var(--color-success)' }} />
            </div>
            <h1 className="text-3xl font-extrabold">Identity Verified</h1>
            <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your Credit Passport is now verified. You have received a <strong>+40 credit point bonus</strong> on-chain, boosting your eligibility and unlocking higher borrow limits.
            </p>
          </div>

          <button onClick={() => router.push('/dashboard')} className="btn-primary btn-accent mt-8 w-full">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Get Verified</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Verify your identity to receive an instant +40 credit point boost and unlock eligible tiers.
        </p>
      </div>

      <div className="card-elevated animate-fade-up">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                Full Name
              </span>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
                placeholder="Juan Dela Cruz"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                Email Address
              </span>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
                placeholder="juan@example.com"
              />
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                ID Type
              </span>
              <select
                value={formData.idType}
                onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors appearance-none"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
              >
                <option>National ID</option>
                <option>Passport</option>
                <option>Driver&apos;s License</option>
                <option>UMID</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                ID Number
              </span>
              <input
                type="text"
                required
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
                placeholder="1234-5678-9012"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-4 text-xs transition-colors hover:bg-slate-800/50 group" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <input
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 accent-[#22C55E]"
              checked={formData.consent}
              onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
            />
            <span style={{ color: 'var(--color-text-secondary)' }} className="group-hover:text-white transition-colors">
              I hereby consent to the processing of my personal data for the purpose of identity verification in accordance with the Data Privacy Act.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !formData.consent}
            className="btn-primary btn-accent w-full justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Verifying...
              </>
            ) : (
              <>
                <UserCheck size={18} />
                Submit Verification
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
