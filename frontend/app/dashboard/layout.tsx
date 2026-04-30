// frontend/app/dashboard/layout.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { AppShell } from '@/components/app-shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      router.replace('/');
    }
  }, [router, user]);

  if (!user) return null;

  return <AppShell>{children}</AppShell>;
}
