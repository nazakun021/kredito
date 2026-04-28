'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../../../lib/api';

export default function RepayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: status } = useQuery({
    queryKey: ['loan-status'],
    queryFn: () => api.get('/loan/status').then(res => res.data),
  });

  const handleRepay = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/loan/repay');
      setSuccess(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Repayment failed');
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
        <h1 className="text-3xl font-bold mb-2">Loan Repaid!</h1>
        <p className="text-gray-500 mb-8">Thank you for your timely repayment. Your credit score will be updated shortly.</p>
        
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

      <h1 className="text-2xl font-bold mb-6">Repay Loan</h1>

      <div className="bg-gray-50 p-6 rounded-2xl mb-8 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 font-medium">Total Amount Due</span>
          <span className="text-2xl font-black">₱5,250.00</span>
        </div>
        <div className="text-sm text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Principal</span>
            <span>₱5,000.00</span>
          </div>
          <div className="flex justify-between">
            <span>Flat Fee (5%)</span>
            <span>₱250.00</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <p className="text-sm text-gray-500 text-center">
          Repayment will be pulled from your PHPC balance. Make sure you have enough funds.
        </p>

        {error && <p className="text-red-500 text-center text-sm">{error}</p>}

        <button
          onClick={handleRepay}
          disabled={loading}
          className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Repay ₱5,250.00 Now'}
        </button>
      </div>
    </div>
  );
}
