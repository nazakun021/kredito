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
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
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
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all"
        >
          <Wallet size={16} className="text-emerald-500" />
          <span>{truncated}</span>
          <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowDropdown(false)} 
            />
            <div className="absolute right-0 mt-2 w-48 py-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-800 transition-colors text-left"
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
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
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
