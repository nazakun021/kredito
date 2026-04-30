// frontend/app/loan/layout.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { AppShell } from '@/components/app-shell';

export default function LoanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && (!user || !token)) {
      router.replace('/');
    }
  }, [hydrated, router, token, user]);

  if (!hydrated || !user || !token) return null;

  return <AppShell>{children}</AppShell>;
}
