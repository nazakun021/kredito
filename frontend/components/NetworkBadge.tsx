'use client';

import { useWalletStore } from '../store/walletStore';
import { REQUIRED_NETWORK } from '../lib/constants';

export default function NetworkBadge() {
  const { isConnected, network } = useWalletStore();

  if (!isConnected || !network) return null;

  const isCorrect = network === REQUIRED_NETWORK;

  return (
    <div 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        isCorrect 
          ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
          : 'bg-red-100 text-red-800 border-red-200'
      }`}
    >
      {isCorrect ? 'Testnet' : network === 'PUBLIC' ? '⚠ Wrong Network' : '⚠ Unknown Network'}
    </div>
  );
}
