// frontend/components/WalletProvider.tsx

'use client';

import { useEffect, ReactNode } from 'react';
import { useWalletStore } from '../store/walletStore';

export default function WalletProvider({ children }: { children: ReactNode }) {
  const restoreSession = useWalletStore((state) => state.restoreSession);
  const hasRestored = useWalletStore((state) => state.hasRestored);

  useEffect(() => {
    if (!hasRestored) {
      void restoreSession();
    }
  }, [hasRestored, restoreSession]);

  return <>{children}</>;
}
