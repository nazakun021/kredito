'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email });
      setAuth(data.token, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 pt-20">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
        <span className="text-white text-3xl font-bold">K</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Welcome to Kredito</h1>
      <p className="text-gray-500 mb-8 text-center">Uncollateralized micro-lending for the unbanked.</p>
      
      <form onSubmit={handleSubmit} className="w-full">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="maria@example.com"
            required
            disabled={loading}
          />
        </div>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Continue →'}
        </button>
      </form>
    </div>
  );
}
