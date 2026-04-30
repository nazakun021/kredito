// frontend/app/dashboard/loading.tsx

import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center animate-fade-up">
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full border-4 border-slate-800" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-accent)' }} />
        </div>
      </div>
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
        Accessing Ledger...
      </p>
    </div>
  );
}
