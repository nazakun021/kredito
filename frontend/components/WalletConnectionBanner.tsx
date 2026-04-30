// frontend/components/WalletConnectionBanner.tsx

'use client';

import { useWalletStore } from '../store/walletStore';
import { AlertTriangle, Wallet } from 'lucide-react';

export default function WalletConnectionBanner() {
  const { isConnected, connect } = useWalletStore();

  if (isConnected) return null;

  return (
    <div 
      className="flex items-center justify-between gap-4 p-4 rounded-xl border animate-fade-up mb-6"
      style={{ 
        background: 'var(--color-danger-bg)', 
        borderColor: 'var(--color-danger)',
        color: 'var(--color-danger)'
      }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} />
        <p className="text-sm font-medium">
          Wallet not connected — connect Freighter to continue with this transaction.
        </p>
      </div>
      <button
        onClick={() => connect()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110"
        style={{ background: 'var(--color-danger)', color: 'white' }}
      >
        <Wallet size={14} />
        Connect Wallet
      </button>
    </div>
  );
}
