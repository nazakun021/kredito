// frontend/app/wallet/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock,
  Copy, 
  ExternalLink, 
  Globe, 
  Loader2, 
  Send, 
  TrendingUp,
  Wallet as WalletIcon,
  CheckCircle2,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { signTx } from '@/lib/freighter';
import { TESTNET_PASSPHRASE } from '@/lib/constants';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  from?: string;
  to?: string;
  timestamp: string;
  isOutbound: boolean;
  transactionHash: string;
}

interface WalletBalance {
  xlmBalance: string;
  phpEquivalent: string;
  phpPrice: number;
}

const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_URL ?? 'https://stellar.expert/explorer/testnet';

export default function WalletPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!user;

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const { networkPassphrase } = useWalletStore();
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showGcashModal, setShowGcashModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const { data: balance, isLoading: isBalanceLoading } = useQuery<WalletBalance>({
    queryKey: ['wallet-balance', user?.wallet],
    queryFn: () => api.get('/wallet/balance').then((res) => res.data),
    enabled: !!user?.wallet,
    refetchInterval: 30000,
  });

  const { data: transactions, isLoading: isTxLoading } = useQuery<Transaction[]>({
    queryKey: ['wallet-transactions', user?.wallet],
    queryFn: () => api.get('/wallet/transactions').then((res) => res.data),
    enabled: !!user?.wallet,
  });

  useEffect(() => {
    if (showReceiveModal && user?.wallet) {
      QRCode.toDataURL(user.wallet, {
        width: 256,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#020617',
        },
      }).then(setQrCodeDataUrl);
    }
  }, [showReceiveModal, user?.wallet]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied!');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Wallet</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Manage your XLM and track on-chain activity.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Balance Hero */}
        <div className="lg:col-span-2 card-elevated animate-fade-up flex flex-col justify-between min-h-[240px] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <WalletIcon size={120} />
          </div>
          
          <div className="relative z-10">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
              Total Balance
            </p>
            {isBalanceLoading ? (
              <div className="skeleton mt-4 h-12 w-48" />
            ) : (
              <div className="mt-4">
                <h2 className="text-5xl font-extrabold tabular-nums">◎{balance?.xlmBalance ?? '0.0000'}</h2>
                <p className="mt-2 text-lg font-bold opacity-60">≈ ₱{balance?.phpEquivalent ?? '0.00'}</p>
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-3 relative z-10">
            <button 
              onClick={() => setShowSendModal(true)}
              className="btn-primary btn-accent flex-1"
            >
              <ArrowUpRight size={18} />
              Send
            </button>
            <button 
              onClick={() => setShowReceiveModal(true)}
              className="btn-primary btn-dark flex-1"
            >
              <ArrowDownLeft size={18} />
              Receive
            </button>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="card-elevated animate-fade-up" style={{ animationDelay: '100ms' }}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-6">
            <Send size={16} style={{ color: 'var(--color-accent)' }} />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => router.push('/staking')}
              className="flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:bg-slate-800/50 group"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <TrendingUp size={24} className="mb-2 text-emerald-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">Stake XLM</span>
            </button>
            <button 
              onClick={() => router.push('/loan/borrow')}
              className="flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:bg-slate-800/50 group"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <WalletIcon size={24} className="mb-2 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold">Borrow XLM</span>
            </button>
            <button 
              onClick={() => setShowGcashModal(true)}
              className="flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:bg-slate-800/50 group"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <div className="h-6 w-6 mb-2 rounded bg-blue-600 flex items-center justify-center text-[10px] font-extrabold text-white group-hover:scale-110 transition-transform">G</div>
              <span className="text-xs font-bold">Connect GCash</span>
            </button>
            <button 
              className="flex flex-col items-center justify-center p-4 rounded-xl opacity-40 cursor-not-allowed"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <div className="h-6 w-6 mb-2 rounded-full bg-slate-700" />
              <span className="text-xs font-bold">USDC (Soon)</span>
            </button>
          </div>
        </div>

        {/* Platforms Card */}
        <div className="card-elevated animate-fade-up" style={{ animationDelay: '200ms' }}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-6">
            <Globe size={16} style={{ color: 'var(--color-accent)' }} />
            Connected Platforms
          </h3>
          <div className="space-y-3">
            <PlatformItem name="Stellar Network" status="Live" icon={CheckCircle2} isLive />
            <PlatformItem name="GCash" status="Soon" icon={Clock} />
            <PlatformItem name="USDC" status="Soon" icon={Clock} />
            <PlatformItem name="Maya" status="Soon" icon={Clock} />
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card-elevated animate-fade-up" style={{ animationDelay: '300ms' }}>
        <h3 className="text-sm font-bold mb-6">Recent Activity</h3>
        <div className="space-y-1">
          {isTxLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-48 mx-auto" />
            ))
          ) : transactions?.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No transactions found yet.
            </p>
          ) : (
            transactions?.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onCopy={copyToClipboard} />
            ))
          )}
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && <SendModal onClose={() => setShowSendModal(false)} balance={balance?.xlmBalance ?? '0'} />}
      
      {/* Receive Modal */}
      {showReceiveModal && (
        <ReceiveModal 
          onClose={() => setShowReceiveModal(false)} 
          address={user?.wallet ?? ''} 
          qrDataUrl={qrCodeDataUrl} 
          onCopy={copyToClipboard}
        />
      )}

      {/* GCash Modal */}
      {showGcashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="card-elevated w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold">Connect GCash</h3>
              <button onClick={() => setShowGcashModal(false)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl font-black text-white mb-6">G</div>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                GCash integration allows you to top up your XLM wallet using Philippine Pesos and cash out your XLM earnings.
              </p>
              <div className="w-full rounded-xl p-4 mb-6 text-xs text-left space-y-2" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="flex justify-between">
                  <span className="opacity-50">Provider</span>
                  <span className="font-bold">Licensed Stellar Anchor</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Currency</span>
                  <span className="font-bold">PHP ↔ XLM</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  toast.info("We'll let you know when this feature is live!");
                  setShowGcashModal(false);
                }}
                className="btn-primary btn-accent w-full"
              >
                Notify me when available
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformItem({ name, status, icon: Icon, isLive }: { name: string; status: string; icon: any; isLive?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--color-bg-card)' }}>
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${isLive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
          <Icon size={14} />
        </div>
        <span className="text-xs font-bold">{name}</span>
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${isLive ? 'text-emerald-500' : 'opacity-40'}`}>
        {status}
      </span>
    </div>
  );
}

function TransactionRow({ tx, onCopy }: { tx: Transaction; onCopy: (t: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl p-4 transition-colors hover:bg-slate-800/30 group">
      <div className="flex items-center gap-4">
        <div 
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: tx.isOutbound ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)' }}
        >
          {tx.isOutbound ? (
            <ArrowUpRight size={18} className="text-red-500" />
          ) : (
            <ArrowDownLeft size={18} className="text-emerald-500" />
          )}
        </div>
        <div>
          <p className="text-sm font-bold">{tx.type}</p>
          <p className="text-xs opacity-50">{tx.timestamp}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold tabular-nums ${tx.isOutbound ? 'text-red-400' : 'text-emerald-400'}`}>
          {tx.isOutbound ? '-' : '+'}◎{tx.amount}
        </p>
        <div className="flex items-center justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onCopy(tx.transactionHash)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-white flex items-center gap-1">
            <Copy size={10} /> Hash
          </button>
          <a 
            href={`${EXPLORER_BASE}/tx/${tx.transactionHash}`} 
            target="_blank" 
            rel="noreferrer"
            className="text-[10px] uppercase font-bold text-slate-500 hover:text-white flex items-center gap-1"
          >
            <ExternalLink size={10} /> Verify
          </a>
        </div>
      </div>
    </div>
  );
}

function SendModal({ onClose, balance }: { onClose: () => void; balance: string }) {
  const user = useAuthStore((s) => s.user);
  const { networkPassphrase } = useWalletStore();
  const queryClient = useQueryClient();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !amount) return;

    setLoading(true);
    try {
      const { data } = await api.post('/wallet/send', { destination: address, amount });
      
      const signResult = await signTx(
        data.unsignedXdr, 
        user!.wallet!, 
        networkPassphrase ?? TESTNET_PASSPHRASE
      );
      
      if ('error' in signResult) throw new Error(signResult.error);

      await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [signResult.signedXdr],
        flow: { action: 'send' },
      });

      toast.success('XLM sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-extrabold">Send XLM</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest opacity-50">Recipient Address</span>
            <input 
              required
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none bg-slate-900 border-slate-800 focus:border-emerald-500 transition-colors"
              placeholder="G..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest opacity-50">Amount (XLM)</span>
              <span className="text-[10px] opacity-50">Balance: ◎{balance}</span>
            </div>
            <input 
              required
              type="number"
              step="0.0000001"
              min="0.0000001"
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none bg-slate-900 border-slate-800 focus:border-emerald-500 transition-colors"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button disabled={loading} type="submit" className="btn-primary btn-accent w-full mt-4">
            {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
            {loading ? 'Processing...' : 'Send XLM'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReceiveModal({ onClose, address, qrDataUrl, onCopy }: { onClose: () => void; address: string; qrDataUrl: string; onCopy: (t: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-md animate-scale-in flex flex-col items-center text-center">
        <div className="w-full flex justify-end">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="bg-white p-4 rounded-3xl mb-6">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Wallet QR" className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-2xl">
              <Loader2 className="animate-spin text-slate-400" />
            </div>
          )}
        </div>

        <h3 className="text-xl font-extrabold mb-2">Receive XLM</h3>
        <p className="text-sm opacity-50 mb-6">Scan this QR or copy the address below</p>

        <div 
          onClick={() => onCopy(address)}
          className="w-full rounded-xl p-4 bg-slate-900 border border-slate-800 cursor-pointer hover:border-emerald-500 transition-all group"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Wallet Address</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono break-all text-emerald-400 group-hover:text-emerald-300">
              {address}
            </span>
            <Copy size={16} className="shrink-0 opacity-40 group-hover:opacity-100" />
          </div>
        </div>

        <p className="mt-6 text-[11px] opacity-40 italic">
          Only send Stellar Assets (XLM) to this address.
        </p>
      </div>
    </div>
  );
}


