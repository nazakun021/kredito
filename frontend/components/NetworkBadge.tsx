// frontend/components/NetworkBadge.tsx

'use client';

import { useWalletStore } from '../store/walletStore';
import { REQUIRED_NETWORK } from '../lib/constants';

export default function NetworkBadge() {
  const { isConnected, network } = useWalletStore();

  if (!isConnected || !network) return null;

  const isCorrect = network === REQUIRED_NETWORK;

  return (
    <div 
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border"
      style={{
        background: isCorrect ? 'var(--color-accent-glow)' : 'var(--color-danger-bg)',
        color: isCorrect ? 'var(--color-accent)' : 'var(--color-danger)',
        borderColor: isCorrect ? 'var(--color-border-accent)' : 'var(--color-danger)'
      }}
    >
      {isCorrect ? 'Testnet ✓' : network === 'PUBLIC' ? '⚠ Wrong Network' : '⚠ Unknown Network'}
    </div>
  );
}
