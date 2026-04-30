// frontend/components/ConnectWalletButton.tsx

'use client';

import { useEffect, useState } from 'react';
import { useWalletStore } from '../store/walletStore';
import { checkFreighterInstalled } from '../lib/freighter';
import { Loader2, Wallet, LogOut, ChevronDown } from 'lucide-react';

export default function ConnectWalletButton() {
  const { 
    isConnected, 
    publicKey, 
    isConnecting, 
    connect, 
    disconnect 
  } = useWalletStore();
  
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    checkFreighterInstalled().then(setInstalled);
  }, []);

  if (installed === false) {
    return (
      <a 
        href="https://freighter.app" 
        target="_blank" 
        rel="noopener noreferrer"
        className="btn-primary"
        style={{ background: 'var(--color-accent)', color: 'var(--color-bg-primary)' }}
      >
        Install Freighter ↗
      </a>
    );
  }

  if (isConnected && publicKey) {
    const truncated = `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
    
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="btn-primary btn-dark flex items-center gap-2 px-4 py-2 text-sm font-medium"
        >
          <Wallet size={16} style={{ color: 'var(--color-accent)' }} />
          <span className="font-mono">{truncated}</span>
          <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowDropdown(false)} 
            />
            <div 
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100"
              style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-[10px] font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Connected Address
                </p>
                <p className="text-xs font-mono break-all" style={{ color: 'var(--color-text-secondary)' }}>
                  {publicKey}
                </p>
              </div>
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm transition-colors text-left hover:bg-slate-800/50"
                style={{ color: 'var(--color-danger)' }}
              >
                <LogOut size={14} />
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => connect()}
      disabled={isConnecting}
      className="btn-primary btn-accent"
    >
      {isConnecting ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <Wallet size={16} />
          <span>Connect Wallet</span>
        </>
      )}
    </button>
  );
}
