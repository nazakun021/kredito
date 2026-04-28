'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Zap, History, UserCheck, CreditCard, Building2, Users } from 'lucide-react';
import api from '../../lib/api';

const factorConfig: Record<string, { icon: any, title: string }> = {
  emailVerified: { icon: UserCheck, title: 'Email Verification' },
  incomeDeclaration: { icon: CreditCard, title: 'Income Profile' },
  cashFlowRatio: { icon: Zap, title: 'Cash Flow' },
  businessPermit: { icon: Building2, title: 'Business Registration' },
  brgyCertificate: { icon: ShieldCheck, title: 'Barangay Verification' },
  coopMembership: { icon: Users, title: 'Community Standing' },
  accountAge: { icon: History, title: 'Stellar Account Age' },
  txVolume: { icon: Zap, title: 'Transaction Activity' },
  repaymentHistory: { icon: History, title: 'Repayment History' },
};

export default function ScorePage() {
  const router = useRouter();

  const { data: score, isLoading } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get('/credit/score').then(res => res.data),
  });

  if (isLoading) return <div className="p-8 text-center">Loading breakdown...</div>;

  return (
    <div className="p-6 pb-20">
      <button onClick={() => router.back()} className="flex items-center text-blue-600 font-bold mb-6">
        <ArrowLeft size={20} className="mr-1" /> Dashboard
      </button>

      <h1 className="text-2xl font-bold mb-2">Score Breakdown</h1>
      <p className="text-gray-500 mb-8">How your <b>{score?.score}/100</b> points were computed.</p>

      <div className="space-y-4">
        {score && Object.entries(score.breakdown).map(([key, data]: [string, any]) => {
          const config = factorConfig[key] || { icon: Zap, title: key.replace(/([A-Z])/g, ' $1') };
          const Icon = config.icon;
          
          return (
            <div key={key} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold capitalize">{config.title}</span>
                  <span className="text-sm font-bold text-blue-600">{data.score}/{data.max}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-1000" 
                    style={{ width: `${(data.score / data.max) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{data.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
