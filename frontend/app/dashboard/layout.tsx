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
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && (!user || !token)) {
      router.replace('/');
    }
  }, [hydrated, router, token, user]);

  if (!hydrated) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="animate-pulse text-muted-foreground font-medium">Loading your profile...</div>
        </div>
      </AppShell>
    );
  }

  if (!user || !token) return null;

  return <AppShell>{children}</AppShell>;
}
