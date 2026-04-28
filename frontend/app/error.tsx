'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'var(--color-danger-bg)' }}
      >
        <AlertTriangle size={28} style={{ color: 'var(--color-danger)' }} />
      </div>
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="btn-primary btn-accent mt-8 max-w-[240px] cursor-pointer"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}
