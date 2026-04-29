'use client';

import { useEffect, ReactNode } from 'react';
import { useWalletStore } from '../store/walletStore';

export default function WalletProvider({ children }: { children: ReactNode }) {
  const restoreSession = useWalletStore((state) => state.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return <>{children}</>;
}
