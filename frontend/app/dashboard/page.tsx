'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Wallet, ExternalLink, ChevronRight, Lock } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () => api.get('/onboarding/status').then(res => res.data),
  });

  const { data: score, isLoading: scoreLoading } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get('/credit/score').then(res => res.data),
    enabled: !!status?.hasCompletedBootstrap,
  });

  const { data: loanStatus } = useQuery({
    queryKey: ['loan-status'],
    queryFn: () => api.get('/loan/status').then(res => res.data),
    enabled: !!status?.hasCompletedBootstrap,
  });

  if (statusLoading) return <div className="p-8 text-center">Loading...</div>;

  if (status && !status.hasCompletedBootstrap) {
    return (
      <div className="p-6 space-y-8 pt-12">
        <div className="bg-blue-600 rounded-3xl p-8 text-white text-center shadow-xl">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Unlock your credit</h1>
          <p className="text-blue-100 mb-6">Complete a 2-minute assessment to see if you qualify for a loan.</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="w-full bg-white text-blue-600 p-4 rounded-xl font-bold hover:bg-blue-50 transition"
          >
            Start Verification
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pt-10">
      {/* Credit Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-blue-100 text-sm font-medium">Credit Score</p>
            <h1 className="text-5xl font-black">{score?.score || '--'}</h1>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            score?.tier === 2 ? 'bg-yellow-400 text-yellow-900' : 
            score?.tier === 1 ? 'bg-green-400 text-green-900' : 'bg-gray-400 text-gray-900'
          }`}>
            {score?.tierLabel || 'Unscored'}
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <p className="text-blue-100 text-xs mb-1 uppercase tracking-widest">Borrow Limit</p>
            <p className="text-xl font-bold">₱{score?.borrowLimit || '0.00'}</p>
          </div>
          <button 
            onClick={() => router.push('/score')}
            className="flex items-center text-sm font-bold bg-white/20 px-3 py-2 rounded-lg hover:bg-white/30 transition"
          >
            Breakdown <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Loan Action */}
      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
        <h2 className="font-bold mb-4">Loan Management</h2>
        {loanStatus?.hasActiveLoan ? (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <span className="text-gray-500">Amount Owed</span>
               <span className="font-bold">₱{loanStatus.loan.totalOwed}</span>
             </div>
             <button
              onClick={() => router.push('/loan/repay')}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold"
             >
               Repay Now
             </button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/loan/borrow')}
            disabled={score?.tier === 0}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold disabled:opacity-50"
          >
            Borrow ₱5,000.00
          </button>
        )}
      </div>

      {/* Wallet Info */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-tighter">Your Wallet</p>
            <p className="text-sm font-mono">{user?.stellarAddress.slice(0, 6)}...{user?.stellarAddress.slice(-6)}</p>
          </div>
        </div>
        <a
          href={`https://stellar.expert/explorer/testnet/account/${user?.stellarAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition"
        >
          <ExternalLink size={20} />
        </a>
      </div>
    </div>
  );
}
