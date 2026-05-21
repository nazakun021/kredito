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
  Loader2, 
  Send, 
  TrendingUp,
  Wallet as WalletIcon,
  CheckCircle2,
  X,
  ShieldAlert,
  PiggyBank,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import Image from 'next/image';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { signTx } from '@/lib/freighter';
import { NETWORK_PASSPHRASE } from '@/lib/constants';

interface Transaction {
  id: string;
  type: string;
  label: string;
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

  const [showSendModal, setShowSendModal] = useState(false);
  const [showKycWarningModal, setShowKycWarningModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showGcashModal, setShowGcashModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const { data: balance, isLoading: isBalanceLoading } = useQuery<WalletBalance>({
    queryKey: ['wallet-balance', user?.wallet],
    queryFn: () => api.get('/wallet/balance').then((res) => res.data),
    enabled: !!user?.wallet,
    refetchInterval: 30000,
  });

  const { data: score } = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: async () => {
      try {
        return await api.get<{ kycVerified: boolean }>('/credit/score').then((res) => res.data);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        if (error?.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
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
    toast.success('Copied!');
  };

  // Group transactions by date
  const groupedTransactions = transactions?.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const date = new Date(tx.timestamp).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Wallet</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Manage your XLM and track on-chain activity.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Balance Hero Card — Glassmorphism */}
        <div className="lg:col-span-2 glass-hero rounded-2xl p-8 animate-fade-up flex flex-col justify-between min-h-[280px] relative overflow-hidden shimmer-overlay">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.03]" 
            style={{ background: 'radial-gradient(circle, var(--color-accent) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} 
          />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-[0.02]"
            style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
          />
          
          {/* Address Pill */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-glow" />
              <span className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: 'var(--color-text-muted)' }}>Stellar Mainnet</span>
            </div>
            <button 
              onClick={() => copyToClipboard(user?.wallet ?? '')}
              className="gradient-border rounded-lg px-3 py-1.5 text-[11px] font-mono tracking-wider font-bold flex items-center gap-2 transition-all hover:bg-white/5 group"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {user?.wallet?.slice(0, 6)}…{user?.wallet?.slice(-4)}
              <Copy size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          
          <div className="relative z-10 flex-1 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Total Balance
            </p>
            {isBalanceLoading ? (
              <div className="skeleton h-14 w-56" />
            ) : (
              <div className="animate-count-up">
                <h2 className="text-5xl font-extrabold tabular-nums tracking-tight">
                  ◎{Number(balance?.xlmBalance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </h2>
                <p className="mt-2 text-lg font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  ≈ ₱{Number(balance?.phpEquivalent ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 relative z-10">
            <button 
              onClick={() => {
                if (score && !score.kycVerified) {
                  setShowKycWarningModal(true);
                } else {
                  setShowSendModal(true);
                }
              }}
              className="btn-primary btn-accent flex-1 justify-center"
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              <ArrowUpRight size={18} />
              Send
            </button>
            <button 
              onClick={() => setShowReceiveModal(true)}
              className="btn-primary btn-dark flex-1 justify-center"
              style={{ borderRadius: 'var(--radius-lg)' }}
            >
              <ArrowDownLeft size={18} />
              Receive
            </button>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="card-elevated animate-fade-up" style={{ animationDelay: '100ms' }}>
          <h3 className="text-sm font-bold flex items-center gap-2 mb-6">
            <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <ActionButton 
              onClick={() => router.push('/staking')}
              icon={<TrendingUp size={22} className="text-emerald-500" />}
              label="Stake XLM"
            />
            <ActionButton 
              onClick={() => router.push('/loan/borrow')}
              icon={<WalletIcon size={22} className="text-indigo-500" />}
              label="Borrow"
            />
            <ActionButton 
              onClick={() => router.push('/deposit')}
              icon={<PiggyBank size={22} className="text-amber-500" />}
              label="Deposit"
            />
            <ActionButton 
              onClick={() => setShowGcashModal(true)}
              icon={<div className="h-[22px] w-[22px] rounded bg-blue-600 flex items-center justify-center text-[10px] font-extrabold text-white">G</div>}
              label="GCash"
            />
          </div>
          
          {/* Connected Platforms */}
          <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
            <h3 className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Connected
            </h3>
            <div className="space-y-2">
              <PlatformItem name="Stellar Network" status="Live" icon={CheckCircle2} isLive />
              <PlatformItem name="GCash" status="Soon" icon={Clock} />
              <PlatformItem name="USDC" status="Soon" icon={Clock} />
              <PlatformItem name="Maya" status="Soon" icon={Clock} />
            </div>
          </div>
        </div>
      </div>

      {/* Transactions — Grouped by Date */}
      <div className="card-elevated animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold">Recent Activity</h3>
          {transactions && transactions.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md" 
              style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)' }}>
              {transactions.length} transactions
            </span>
          )}
        </div>
        <div className="space-y-1">
          {isTxLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-16 mb-2" />
            ))
          ) : !transactions?.length ? (
            <div className="py-16 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-bg-elevated)' }}>
                <WalletIcon size={24} className="opacity-20" />
              </div>
              <p className="text-sm font-semibold opacity-40">No transactions found yet</p>
              <p className="text-xs opacity-30 mt-1">Your transaction history will appear here</p>
            </div>
          ) : (
            Object.entries(groupedTransactions ?? {}).map(([date, txs]) => (
              <div key={date}>
                <p className="text-[10px] font-bold uppercase tracking-widest py-3 px-2" style={{ color: 'var(--color-text-muted)' }}>
                  {date}
                </p>
                {txs.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onCopy={copyToClipboard} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && <SendModal onClose={() => setShowSendModal(false)} balance={balance?.xlmBalance ?? '0'} />}
      
      {/* KYC Warning Modal */}
      {showKycWarningModal && (
        <KycRequiredModal onClose={() => setShowKycWarningModal(false)} />
      )}
      
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card-elevated w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold">Connect GCash</h3>
              <button onClick={() => setShowGcashModal(false)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
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

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 rounded-xl transition-all hover:bg-white/5 hover:scale-[1.02] active:scale-[0.98] group"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="mb-2 group-hover:scale-110 transition-transform duration-200">
        {icon}
      </div>
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function PlatformItem({ name, status, icon: Icon, isLive }: { name: string; status: string; icon: React.ElementType; isLive?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/[0.02]" style={{ background: 'var(--color-bg-card)' }}>
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${isLive ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-500'}`} style={{ background: isLive ? undefined : 'var(--color-bg-elevated)' }}>
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
  const time = new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <div className="flex items-center justify-between rounded-xl p-4 transition-all hover:bg-white/[0.03] group">
      <div className="flex items-center gap-4">
        <div 
          className="flex h-10 w-10 items-center justify-center rounded-full transition-transform group-hover:scale-105"
          style={{ background: tx.isOutbound ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)' }}
        >
          {tx.isOutbound ? (
            <ArrowUpRight size={18} className="text-red-400" />
          ) : (
            <ArrowDownLeft size={18} className="text-emerald-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-bold">{tx.label}</p>
          <p className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{time}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold tabular-nums ${tx.isOutbound ? 'text-red-400' : 'text-emerald-400'}`}>
          {tx.isOutbound ? '-' : '+'}◎{tx.amount}
        </p>
        <div className="flex items-center justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={() => onCopy(tx.transactionHash)} className="text-[10px] uppercase font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
            <Copy size={10} /> Hash
          </button>
          <a 
            href={`${EXPLORER_BASE}/tx/${tx.transactionHash}`} 
            target="_blank" 
            rel="noreferrer"
            className="text-[10px] uppercase font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
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
        networkPassphrase ?? NETWORK_PASSPHRASE
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-extrabold">Send XLM</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated w-full max-w-md animate-scale-in flex flex-col items-center text-center">
        <div className="w-full flex justify-end">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="bg-white p-4 rounded-3xl mb-6">
          {qrDataUrl ? (
            <Image src={qrDataUrl} alt="Wallet QR" width={192} height={192} className="w-48 h-48" unoptimized />
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
          className="w-full rounded-xl p-4 cursor-pointer hover:border-emerald-500 transition-all group gradient-border"
          style={{ background: 'var(--color-bg-card)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Wallet Address</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono break-all text-emerald-400 group-hover:text-emerald-300 transition-colors">
              {address}
            </span>
            <Copy size={16} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <p className="mt-6 text-[11px] opacity-40 italic">
          Only send Stellar Assets (XLM) to this address.
        </p>
      </div>
    </div>
  );
}

function KycRequiredModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card-elevated w-full max-w-md animate-scale-in text-center p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
        <div className="w-full flex justify-end mb-2">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500 mb-6">
          <ShieldAlert size={32} />
        </div>
        <h3 className="text-xl font-extrabold mb-3">Identity Verification Required</h3>
        <p className="text-sm opacity-70 mb-8 leading-relaxed">
          To comply with safety standards and regulatory requirements, all outbound XLM transfers and withdrawals require an active on-chain KYC verification.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onClose();
              router.push('/kyc');
            }}
            className="btn-primary btn-accent w-full justify-center"
          >
            Start KYC Verification
          </button>
          <button
            onClick={onClose}
            className="btn-primary btn-dark w-full justify-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


