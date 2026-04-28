'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../../lib/api';

export default function BorrowPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: score } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get('/credit/score').then(res => res.data),
  });

  const handleBorrow = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/loan/borrow', { amount: 5000 });
      setSuccess(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Borrowing failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 text-center pt-20">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} />
        </div>
        <h1 className="text-3xl font-bold mb-2">Success!</h1>
        <p className="text-gray-500 mb-8">₱5,000.00 has been disbursed to your wallet.</p>
        
        <div className="bg-gray-50 p-6 rounded-2xl mb-8 text-left space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Amount</span>
            <span className="font-bold">₱{success.amount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Fee (5%)</span>
            <span className="font-bold">₱{success.fee}</span>
          </div>
          <div className="flex justify-between border-t pt-2 mt-2">
            <span className="font-bold">Total Owed</span>
            <span className="font-bold text-blue-600">₱{success.totalOwed}</span>
          </div>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button onClick={() => router.back()} className="flex items-center text-blue-600 font-bold mb-6">
        <ArrowLeft size={20} className="mr-1" /> Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Confirm Borrowing</h1>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl mb-8">
        <div className="flex justify-between items-center mb-4">
          <span className="text-blue-600 font-bold">Loan Amount</span>
          <span className="text-2xl font-black text-blue-600">₱5,000.00</span>
        </div>
        <div className="space-y-2 text-sm text-blue-800 opacity-80">
          <div className="flex justify-between">
            <span>Interest Rate</span>
            <span>0% (Flat Fee Only)</span>
          </div>
          <div className="flex justify-between">
            <span>Platform Fee (5%)</span>
            <span>₱250.00</span>
          </div>
          <div className="flex justify-between font-bold border-t border-blue-200 pt-2 mt-2">
            <span>Total Repayment</span>
            <span>₱5,250.00</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex gap-3">
          <AlertCircle className="text-gray-400 shrink-0" size={20} />
          <p className="text-sm text-gray-500">
            This loan is due in <b>30 days</b>. Late repayment will result in a credit score penalty and loss of Tier {score?.tier} status.
          </p>
        </div>

        <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 w-5 h-5"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-sm font-medium">I understand and agree to the repayment terms and the 30-day deadline.</span>
        </label>

        {error && <p className="text-red-500 text-center text-sm">{error}</p>}

        <button
          onClick={handleBorrow}
          disabled={!agreed || loading}
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Confirm Borrow ₱5,000'}
        </button>
      </div>
    </div>
  );
}
