// frontend/app/deposit/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Info, 
  Loader2, 
  PiggyBank, 
  ShieldCheck, 
  TrendingUp, 
  X,
  ShieldAlert
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { signTx } from '@/lib/freighter';
import { NETWORK_PASSPHRASE } from '@/lib/constants';

const LEDGERS_PER_DAY = 17280; // 5s close time

interface DepositTerm {
  label: string;
  ledgers: number;
  apy: number;
  apyBps: number;
}

interface ActiveDeposit {
  amount: string;
  estimatedReturn: string;
  maturesAt: string;
  isMatured: boolean;
  progress: number;
  canWithdraw: boolean;
  daysRemaining: number;
  earlyWithdrawalPenaltyXlm: string;
}

export default function DepositPage() {
  const user = useAuthStore((s) => s.user);
  const { networkPassphrase } = useWalletStore();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<DepositTerm | null>(null);

  const { data: score } = useQuery({
    queryKey: QUERY_KEYS.score(user?.wallet ?? ''),
    queryFn: () => api.get<{ kycVerified: boolean }>('/credit/score').then((res) => res.data),
    enabled: !!user?.wallet,
  });

  const { data: terms, isLoading: isTermsLoading } = useQuery<DepositTerm[]>({
    queryKey: ['deposit-terms'],
    queryFn: () => api.get('/deposit/terms').then((res) => res.data),
  });

  const { data: active, isLoading: isActiveLoading } = useQuery<ActiveDeposit | null>({
    queryKey: ['deposit-position', user?.wallet],
    queryFn: () => api.get('/deposit/position').then((res) => res.data),
    enabled: !!user?.wallet,
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!active?.canWithdraw) {
        const penalty = active?.earlyWithdrawalPenaltyXlm ?? '0.00';
        const netAmount = (Number(active?.amount ?? 0) - Number(penalty)).toFixed(4);
        const confirmed = window.confirm(
          `Early Withdrawal Warning:\n\nWithdrawing before maturity will forfeit all accrued interest and deduct a simulated 1% early withdrawal penalty of ◎${penalty} XLM.\n\nYou will receive a net amount of ◎${netAmount} XLM instead of ◎${active?.amount ?? 0} XLM.\n\nAre you sure you want to proceed with early withdrawal?`
        );
        if (!confirmed) return;
      }
      
      const { data } = await api.post('/deposit/withdraw');
      const signResult = await signTx(
        data.unsignedXdr, 
        user!.wallet!, 
        networkPassphrase ?? NETWORK_PASSPHRASE
      );
      if ('error' in signResult) throw new Error(signResult.error);
      return api.post('/tx/sign-and-submit', {
        signedInnerXdr: [signResult.signedXdr],
        flow: { action: 'withdraw_deposit' },
      });
    },
    onSuccess: () => {
      toast.success('Funds withdrawn successfully!');
      queryClient.invalidateQueries({ queryKey: ['deposit-position'] });
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message || 'Withdrawal failed');
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Time Deposit</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Lock your XLM for a fixed term and earn guaranteed interest.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Deposit Card */}
        <div className="lg:col-span-2 card-elevated animate-fade-up min-h-[300px] flex flex-col">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-8">
            <ShieldCheck size={16} style={{ color: 'var(--color-accent)' }} />
            Active Deposit
          </h3>

          {isActiveLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin opacity-20" />
            </div>
          ) : active ? (
            <div className="flex-1 flex flex-col">
              <div className="grid gap-6 sm:grid-cols-3 mb-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Principal</p>
                  <p className="text-2xl font-extrabold tabular-nums">◎{active.amount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Interest</p>
                  <p className="text-2xl font-extrabold text-emerald-500 tabular-nums">+◎{active.estimatedReturn}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Maturity Date</p>
                  <p className="text-sm font-bold mt-2">{new Date(active.maturesAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex justify-between text-xs font-bold mb-3">
                  <span style={{ color: active.canWithdraw ? 'var(--color-success)' : 'inherit' }}>
                    {active.canWithdraw ? 'Deposit Matured' : `${active.daysRemaining} days remaining`}
                  </span>
                  <span className="opacity-40">{Math.round(active.progress)}%</span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden mb-6" style={{ background: 'var(--color-bg-elevated)' }}>
                  <div 
                    className="h-full rounded-full transition-all duration-1000 bg-emerald-500 progress-animated" 
                    style={{ width: `${active.progress}%` }} 
                  />
                </div>

                {!active.canWithdraw && score?.kycVerified && (
                  <div className="mb-6 rounded-xl p-4 bg-amber-500/10 border border-amber-500/20 flex gap-3 text-amber-500">
                    <Info size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold">Early Withdrawal Warning</p>
                      <p className="text-xs mt-1 opacity-80">
                        Withdrawing before maturity will forfeit all accrued interest and charge a simulated early withdrawal penalty of <strong className="font-extrabold text-white">1% (◎{active.earlyWithdrawalPenaltyXlm} XLM)</strong>. You will receive ◎{(Number(active.amount) - Number(active.earlyWithdrawalPenaltyXlm)).toFixed(4)} XLM.
                      </p>
                    </div>
                  </div>
                )}

                {score && !score.kycVerified && (
                  <div className="mb-6 rounded-xl p-4 bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400">
                    <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold">Identity Verification Required to Withdraw</p>
                      <p className="text-xs mt-1 opacity-80">
                        Please complete your KYC verification to unlock withdrawals for your time deposit principal and earnings.
                      </p>
                    </div>
                  </div>
                )}

                <button 
                  disabled={withdrawMutation.isPending || (score && !score.kycVerified)}
                  onClick={() => withdrawMutation.mutate()}
                  className={`btn-primary w-full ${score && !score.kycVerified ? 'bg-red-950/20 text-red-500/50 cursor-not-allowed border border-red-900/30' : active.canWithdraw ? 'btn-accent' : 'btn-dark'}`}
                >
                  {withdrawMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : score && !score.kycVerified ? (
                    <ShieldAlert size={18} />
                  ) : active.canWithdraw ? (
                    <TrendingUp size={18} />
                  ) : (
                    <X size={18} />
                  )}
                  {score && !score.kycVerified 
                    ? 'KYC Verification Required to Withdraw'
                    : active.canWithdraw 
                      ? 'Withdraw Principal + Interest' 
                      : 'Withdraw Principal Only (Early)'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--color-bg-elevated)' }}>
                <PiggyBank size={32} className="opacity-20" />
              </div>
              <p className="text-sm opacity-40 max-w-xs">You don&apos;t have any active deposits. Choose a term below to start earning.</p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="card-elevated animate-fade-up text-sm">
          <h3 className="font-bold mb-4">Deposit Terms</h3>
          <ul className="space-y-4 opacity-70">
            <li className="flex gap-3">
              <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: 'var(--color-bg-elevated)' }}>!</div>
              <p>Withdrawing before maturity returns your principal only — accrued interest is forfeited.</p>
            </li>
            <li className="flex gap-3">
              <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: 'var(--color-bg-elevated)' }}>!</div>
              <p>Interest is guaranteed and reserved from the pool at the time of deposit.</p>
            </li>
          </ul>
        </div>
      </div>

      {/* Terms Table */}
      {!active && !isActiveLoading && (
        <div className="card-elevated animate-fade-up" style={{ animationDelay: '100ms' }}>
          <h3 className="text-sm font-bold mb-6">Available Terms</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest opacity-40 border-b border-slate-800">
                  <th className="pb-4">Duration</th>
                  <th className="pb-4">Ledgers</th>
                  <th className="pb-4">Est. APY</th>
                  <th className="pb-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {isTermsLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={i}><td colSpan={4} className="py-8"><div className="skeleton h-12 w-full" /></td></tr>
                  ))
                ) : (
                  terms?.map((term) => (
                    <tr key={term.label} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <td className="py-4 font-bold">{term.label}</td>
                      <td className="py-4 opacity-60 tabular-nums">{term.ledgers.toLocaleString()}</td>
                      <td className="py-4 text-emerald-500 font-bold tabular-nums">{term.apy}%</td>
                      <td className="py-4 text-right">
                        <button 
                          onClick={() => {
                            setSelectedTerm(term);
                            setShowCreateModal(true);
                          }}
                          className="btn-primary btn-dark py-2 px-4 text-xs"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && selectedTerm && (
        <CreateDepositModal 
          onClose={() => setShowCreateModal(false)} 
          term={selectedTerm} 
        />
      )}
    </div>
  );
}

function CreateDepositModal({ onClose, term }: { onClose: () => void; term: DepositTerm }) {
  const user = useAuthStore((s) => s.user);
  const { networkPassphrase } = useWalletStore();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    setLoading(true);
    try {
      // Create Deposit
      const { data } = await api.post('/deposit/create', { 
        amount, 
        termLedgers: term.ledgers,
        apyBps: term.apyBps
      });
      
      const signResult = await signTx(
        data.unsignedXdr, 
        user!.wallet!, 
        networkPassphrase ?? NETWORK_PASSPHRASE
      );
      
      if ('error' in signResult) throw new Error(signResult.error);

      await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [signResult.signedXdr],
        flow: { action: 'create_deposit' },
      });

      toast.success('Deposit created successfully!');
      queryClient.invalidateQueries({ queryKey: ['deposit-position'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const estimatedInterest = amount 
    ? (
        (Number(amount) * (term.apyBps / 10_000) * term.ledgers) / 
        (365 * LEDGERS_PER_DAY)
      ).toFixed(4) 
    : '0.0000';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-extrabold">New Deposit</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="rounded-xl p-4 bg-slate-900 border border-slate-800 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Duration</p>
              <p className="font-bold text-emerald-500">{term.label}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Fixed APY</p>
              <p className="font-bold text-emerald-500">{term.apy}%</p>
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest opacity-50">Amount to Lock (XLM)</span>
            <input 
              required
              type="number"
              step="0.01"
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none bg-slate-900 border-slate-800 focus:border-emerald-500 transition-colors"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          <div className="rounded-xl p-4 bg-emerald-500/5 border border-emerald-500/10 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="opacity-50">Estimated Interest</span>
              <span className="font-bold text-emerald-500">+◎{estimatedInterest}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="opacity-50">Total Maturity Value</span>
              <span className="font-bold">◎{(Number(amount || 0) + Number(estimatedInterest)).toFixed(4)}</span>
            </div>
          </div>

          <button disabled={loading} type="submit" className="btn-primary btn-accent w-full mt-4">
            {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
            {loading ? 'Confirming...' : 'Create Time Deposit'}
          </button>
        </form>
      </div>
    </div>
  );
}
