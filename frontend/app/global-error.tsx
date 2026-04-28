'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: '#020617',
          color: '#F8FAFC',
          fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '24px',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 16,
              borderRadius: 16,
              background: 'rgba(239, 68, 68, 0.1)',
              marginBottom: 24,
            }}
          >
            <AlertTriangle size={32} color="#EF4444" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 28px',
              borderRadius: 12,
              background: '#22C55E',
              color: '#020617',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
