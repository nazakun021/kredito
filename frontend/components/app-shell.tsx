// frontend/components/app-shell.tsx

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChartColumn,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import ConnectWalletButton from './ConnectWalletButton';
import NetworkBadge from './NetworkBadge';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/loan/borrow', label: 'Borrow', icon: CreditCard },
  { href: '/loan/repay', label: 'Repay', icon: ChartColumn },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const disconnectWallet = useWalletStore((s) => s.disconnect);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (hydrated && (!user || !token) && !isLoggingOut) {
      router.replace('/');
    }
  }, [hydrated, user, token, isLoggingOut, router]);

  const handleLogout = () => {
    setIsLoggingOut(true);
    clearAuth();
    disconnectWallet();
    router.replace('/');
  };

  if (!hydrated || isLoggingOut || !user || !token) {
    return null;
  }

  const currentRouteName = navItems.find((n) => pathname.startsWith(n.href))?.label ?? 'Kredito';

  return (
    <div className="flex min-h-dvh">
      <aside
        className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-r lg:fixed lg:inset-y-0 lg:left-0"
        style={{
          background: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <SidebarContent pathname={pathname} onLogout={handleLogout} />
      </aside>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col lg:hidden animate-slide-in-left"
            style={{
              background: 'var(--color-bg-secondary)',
              borderRight: '1px solid var(--color-border)',
            }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg cursor-pointer z-50"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              aria-label="Close menu"
            >
              <X size={16} style={{ color: 'var(--color-text-muted)' }} />
            </button>
            <SidebarContent
              pathname={pathname}
              onLogout={handleLogout}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex flex-1 flex-col lg:ml-[260px]">
        <header
          className="sticky top-0 z-30 flex h-16 items-center gap-4 px-6 lg:px-10"
          style={{
            background: 'rgba(2, 6, 23, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg cursor-pointer lg:hidden"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            aria-label="Open menu"
          >
            <Menu size={16} style={{ color: 'var(--color-text-secondary)' }} />
          </button>

          <div className="flex flex-col lg:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} style={{ color: 'var(--color-accent)' }} />
              <span className="text-xs font-bold">Kredito</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
              {currentRouteName}
            </span>
          </div>

          <div className="flex-1" />

          <h1 className="hidden text-sm font-semibold lg:block" style={{ color: 'var(--color-text-secondary)' }}>
            {currentRouteName}
          </h1>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <NetworkBadge />
            </div>
            <ConnectWalletButton />
          </div>

          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-lg cursor-pointer lg:hidden"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            aria-label="Disconnect wallet session"
          >
            <LogOut size={14} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </header>

        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onLogout,
  onNavClick,
}: {
  pathname: string;
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  const walletAddress = useWalletStore((s) => s.publicKey);
  return (
    <>
      <div className="flex items-center gap-3 px-6 py-6">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}
        >
          <ShieldCheck size={20} style={{ color: 'var(--color-accent)' }} />
        </div>
        <div>
          <p className="text-base font-bold">Kredito</p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            Credit Passport
          </p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: isActive ? 'var(--color-accent-glow)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                border: isActive ? '1px solid var(--color-border-accent)' : '1px solid transparent',
              }}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-4 py-5" style={{ borderColor: 'var(--color-border)' }}>
        {walletAddress && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-xs font-mono"
            style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}
          >
            {walletAddress.slice(0, 8)}…{walletAddress.slice(-8)}
          </div>
        )}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium cursor-pointer transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <LogOut size={16} />
          Disconnect Wallet
        </button>
      </div>
    </>
  );
}
