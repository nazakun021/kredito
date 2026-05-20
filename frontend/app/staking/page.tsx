// frontend/app/staking/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowRight, 
  Coins, 
  Info, 
  Loader2, 
  Lock, 
  Plus, 
  TrendingUp, 
  Unlock, 
  X 
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useWalletStore } from '@/store/walletStore';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { toast } from 'sonner';
import { signTx } from '@/lib/freighter';
import { TESTNET_PASSPHRASE } from '@/lib/constants';
import SummaryRow from '@/components/SummaryRow';

interface StakingInfo {
  poolBalance: string;
  totalStaked: string;
  totalRewardPool: string;
  apy: number;
}

interface StakingPosition {
  stakedAmount: string;
  pendingRewards: string;
  shareBps: number;
}

export default function StakingPage() {
  const user = useAuthStore((s) => s.user);
  const { networkPassphrase } = useWalletStore();
  const queryClient = useQueryClient();
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);

  const { data: info, isLoading: isInfoLoading } = useQuery<StakingInfo>({
    queryKey: ['staking-info'],
    queryFn: () => api.get('/staking/info').then((res) => res.data),
    refetchInterval: 30000,
  });

  const { data: position, isLoading: isPositionLoading } = useQuery<StakingPosition>({
    queryKey: ['staking-position', user?.wallet],
    queryFn: () => api.get('/staking/position').then((res) => res.data),
    enabled: !!user?.wallet,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Stake & Earn</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Provide liquidity to the lending pool and earn a share of the fees.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pool Stats */}
        <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
          <StatCard 
            label="Total Staked" 
            value={`◎${info?.totalStaked ?? '0.00'}`} 
            icon={Lock} 
            loading={isInfoLoading} 
          />
          <StatCard 
            label="Reward Pool" 
            value={`◎${info?.totalRewardPool ?? '0.00'}`} 
            icon={TrendingUp} 
            loading={isInfoLoading} 
            color="var(--color-accent)"
          />
        </div>

        {/* APR Card */}
        <div className="card-elevated animate-fade-up flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Estimated APY</p>
          <p className="mt-2 text-5xl font-extrabold text-emerald-500">{(info?.apy ?? 8.5).toFixed(1)}%</p>
          <p className="mt-4 text-xs opacity-50 max-w-[200px]">Based on current loan volume and pool size.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Position */}
        <div className="lg:col-span-2 card-elevated animate-fade-up">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-8">
            <Coins size={16} style={{ color: 'var(--color-accent)' }} />
            Your Position
          </h3>
          
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Staked Amount</p>
              <p className="text-2xl font-extrabold tabular-nums">◎{position?.stakedAmount ?? '0.00'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Pending Rewards</p>
              <p className="text-2xl font-extrabold text-emerald-500 tabular-nums">◎{position?.pendingRewards ?? '0.00'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Pool Share</p>
              <p className="text-2xl font-extrabold tabular-nums">
                {((position?.shareBps ?? 0) / 100).toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button 
              onClick={() => setShowStakeModal(true)}
              className="btn-primary btn-accent flex-1"
            >
              <Plus size={18} />
              Stake XLM
            </button>
            <button 
              onClick={() => setShowUnstakeModal(true)}
              disabled={Number(position?.stakedAmount ?? 0) <= 0}
              className="btn-primary btn-dark flex-1"
            >
              <Unlock size={18} />
              Unstake
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="card-elevated animate-fade-up text-sm">
          <h3 className="font-bold mb-4">How it works</h3>
          <ul className="space-y-4 opacity-70">
            <li className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[10px] font-bold">1</div>
              <p>Stake XLM into the lending pool. Your funds are never lent out (they remain in the contract as a safety reserve).</p>
            </li>
            <li className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[10px] font-bold">2</div>
              <p>When borrowers repay their loans, 50% of the flat fee is distributed to the staking pool.</p>
            </li>
            <li className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-[10px] font-bold">3</div>
              <p>Rewards accumulate in real-time based on your share of the pool. Unstake anytime to claim principal + rewards.</p>
            </li>
          </ul>
        </div>
      </div>

      {showStakeModal && <StakeModal onClose={() => setShowStakeModal(false)} />}
      {showUnstakeModal && <UnstakeModal onClose={() => setShowUnstakeModal(false)} position={position} />}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, loading, color }: { label: string; value: string; icon: any; loading: boolean; color?: string }) {
  return (
    <div className="card-elevated animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{label}</p>
        <div className="p-2 rounded-lg bg-slate-800">
          <Icon size={16} style={{ color: color ?? 'inherit' }} />
        </div>
      </div>
      {loading ? (
        <div className="skeleton mt-4 h-9 w-32" />
      ) : (
        <p className="mt-4 text-3xl font-extrabold tabular-nums">{value}</p>
      )}
    </div>
  );
}

function StakeModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { networkPassphrase } = useWalletStore();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    setLoading(true);
    try {
      const { data } = await api.post('/staking/stake', { amount });
      
      const signResult = await signTx(
        data.unsignedXdr, 
        user!.wallet!, 
        networkPassphrase ?? TESTNET_PASSPHRASE
      );
      
      if ('error' in signResult) throw new Error(signResult.error);

      await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [signResult.signedXdr],
        flow: { action: 'stake' },
      });

      toast.success('Staked successfully!');
      queryClient.invalidateQueries({ queryKey: ['staking-info'] });
      queryClient.invalidateQueries({ queryKey: ['staking-position'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Staking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-extrabold">Stake XLM</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleStake} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest opacity-50">Amount to Stake (XLM)</span>
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
          <div className="flex gap-3 rounded-xl p-4 text-xs opacity-70" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <Info size={16} className="shrink-0" />
            <p>Staked funds are used as a safety reserve and earn 50% of all platform fees. They are NOT lent out to borrowers.</p>
          </div>
          <button disabled={loading} type="submit" className="btn-primary btn-accent w-full mt-4">
            {loading ? <Loader2 className="animate-spin" /> : <Lock size={18} />}
            {loading ? 'Processing...' : 'Confirm Stake'}
          </button>
        </form>
      </div>
    </div>
  );
}

function UnstakeModal({ onClose, position }: { onClose: () => void; position?: StakingPosition }) {
  const user = useAuthStore((s) => s.user);
  const { networkPassphrase } = useWalletStore();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnstake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    if (Number(amount) > Number(position?.stakedAmount ?? 0)) {
      toast.error(`Cannot unstake more than your staked amount (◎${position?.stakedAmount})`);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/staking/unstake', { amount });
      
      const signResult = await signTx(
        data.unsignedXdr, 
        user!.wallet!, 
        networkPassphrase ?? TESTNET_PASSPHRASE
      );
      
      if ('error' in signResult) throw new Error(signResult.error);

      await api.post('/tx/sign-and-submit', {
        signedInnerXdr: [signResult.signedXdr],
        flow: { action: 'unstake' },
      });

      toast.success('Unstaked successfully!');
      queryClient.invalidateQueries({ queryKey: ['staking-info'] });
      queryClient.invalidateQueries({ queryKey: ['staking-position'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unstaking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="card-elevated w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-extrabold">Unstake XLM</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUnstake} className="space-y-4">
          <label className="block">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest opacity-50">Amount to Unstake</span>
              <span className="text-[10px] opacity-50">Staked: ◎{position?.stakedAmount ?? '0.00'}</span>
            </div>
            <input 
              required
              type="number"
              step="0.01"
              max={position?.stakedAmount}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none bg-slate-900 border-slate-800 focus:border-emerald-500 transition-colors"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="flex gap-3 rounded-xl p-4 text-xs opacity-70" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <TrendingUp size={16} className="shrink-0 text-emerald-500" />
            <p>Unstaking will also automatically claim your pending rewards (◎{position?.pendingRewards ?? '0.00'}).</p>
          </div>
          <button disabled={loading} type="submit" className="btn-primary btn-dark w-full mt-4">
            {loading ? <Loader2 className="animate-spin" /> : <Unlock size={18} />}
            {loading ? 'Processing...' : 'Confirm Unstake'}
          </button>
        </form>
      </div>
    </div>
  );
}
