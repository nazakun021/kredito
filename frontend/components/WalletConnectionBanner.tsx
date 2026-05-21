// frontend/components/WalletConnectionBanner.tsx

'use client';

import { useWalletStore } from '../store/walletStore';
import { REQUIRED_NETWORK, FRIENDLY_NETWORK_NAME } from '../lib/constants';
import { AlertTriangle, Wallet } from 'lucide-react';

export default function WalletConnectionBanner() {
  const { isConnected, network, connect } = useWalletStore();

  if (isConnected && network === REQUIRED_NETWORK) return null;

  const message = !isConnected
    ? 'Wallet not connected — connect Freighter to continue.'
    : `Wrong network — switch Freighter to ${FRIENDLY_NETWORK_NAME} to continue.`;

  return (
    <div 
      className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border animate-fade-up mb-6"
      style={{ 
        background: 'var(--color-danger-bg)', 
        borderColor: 'var(--color-danger)',
        color: 'var(--color-danger)'
      }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} aria-hidden="true" />
        <p className="text-sm font-medium">
          {message}
        </p>
      </div>
      <button
        onClick={() => connect()}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:brightness-110"
        style={{ background: 'var(--color-danger)', color: 'white' }}
      >
        <Wallet size={14} aria-hidden="true" />
        Connect Wallet
      </button>
    </div>
  );
}
