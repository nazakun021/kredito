// frontend/app/loan/error.tsx

'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center p-6 text-center animate-fade-up">
      <div 
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-6" 
        style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)' }}
      >
        <AlertCircle size={32} style={{ color: 'var(--color-danger)' }} />
      </div>
      
      <h2 className="text-xl font-bold mb-2">Transaction error</h2>
      <p className="text-sm max-w-xs mx-auto mb-8" style={{ color: 'var(--color-text-secondary)' }}>
        Something went wrong while processing the loan flow. This could be due to network congestion or a signature rejection.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="btn-primary btn-dark inline-flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Try again
        </button>
        <Link
          href="/dashboard"
          className="btn-primary border border-slate-700 inline-flex items-center gap-2"
          style={{ background: 'transparent', color: 'var(--color-text-primary)' }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
