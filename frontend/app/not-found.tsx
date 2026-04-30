// frontend/app/not-found.tsx

import Link from 'next/link';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="animate-fade-up">
        <div 
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-8" 
          style={{ background: 'var(--color-accent-glow)', border: '1px solid var(--color-border-accent)' }}
        >
          <ShieldCheck size={32} style={{ color: 'var(--color-accent)' }} />
        </div>
        
        <h1 className="text-4xl font-extrabold mb-4">404</h1>
        <h2 className="text-xl font-bold mb-2">Page not found</h2>
        <p className="text-sm max-w-xs mx-auto mb-10" style={{ color: 'var(--color-text-secondary)' }}>
          The path you&apos;re looking for doesn&apos;t exist or has been moved within the Credit Passport system.
        </p>

        <Link 
          href="/dashboard" 
          className="btn-primary btn-accent inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
