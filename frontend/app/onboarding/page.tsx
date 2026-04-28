'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Lock, Mail, Wallet, Shield, ChartBar } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [formData, setFormData] = useState({
    monthlyIncomeBand: '5k-10k',
    monthlyExpenseBand: '5k-10k',
    employmentType: 'irregular',
    hasBusinessPermit: false,
    hasBrgyCertificate: false,
    hasCoopMembership: false,
  });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/onboarding/send-otp');
      setOtpSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/onboarding/verify-otp', { otp });
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/onboarding/submit', formData);
      setResult(data);
      setStep(4);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Progress Bar */}
      <div className="flex mb-8 gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full ${
              step >= i ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={32} />
            </div>
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p className="text-gray-500">We'll send a code to {user?.email}</p>
          </div>

          {!otpSent ? (
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                className="w-full p-4 border-2 rounded-xl text-center text-2xl tracking-widest font-bold outline-none focus:border-blue-500"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
              </button>
              <button
                onClick={handleSendOtp}
                className="w-full text-blue-600 font-medium"
              >
                Resend Code
              </button>
            </div>
          )}
          {error && <p className="text-red-500 text-center">{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Financial Profile</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Monthly Income</label>
              <select
                className="w-full p-3 border rounded-lg"
                value={formData.monthlyIncomeBand}
                onChange={(e) => setFormData({...formData, monthlyIncomeBand: e.target.value})}
              >
                <option value="<5k">Less than ₱5,000</option>
                <option value="5k-10k">₱5,000 – ₱10,000</option>
                <option value="10k-20k">₱10,000 – ₱20,000</option>
                <option value=">20k">More than ₱20,000</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Monthly Expenses</label>
              <select
                className="w-full p-3 border rounded-lg"
                value={formData.monthlyExpenseBand}
                onChange={(e) => setFormData({...formData, monthlyExpenseBand: e.target.value})}
              >
                <option value="<5k">Less than ₱5,000</option>
                <option value="5k-10k">₱5,000 – ₱10,000</option>
                <option value="10k-20k">₱10,000 – ₱20,000</option>
                <option value=">20k">More than ₱20,000</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Employment Type</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'self_employed', label: 'Business Owner' },
                  { id: 'employed', label: 'Regularly Employed' },
                  { id: 'irregular', label: 'Irregular Income' }
                ].map((type) => (
                  <label key={type.id} className={`flex items-center p-3 border rounded-lg cursor-pointer ${formData.employmentType === type.id ? 'border-blue-600 bg-blue-50' : ''}`}>
                    <input
                      type="radio"
                      name="employment"
                      className="hidden"
                      checked={formData.employmentType === type.id}
                      onChange={() => setFormData({...formData, employmentType: type.id})}
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setStep(3)}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold"
          >
            Next Step
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Community Attestation</h1>
          <p className="text-gray-500">Do any of these apply to you?</p>
          <div className="space-y-4">
            {[
              { id: 'hasBusinessPermit', label: 'Registered Business', desc: 'DTI, SEC, or Mayor\'s Permit' },
              { id: 'hasBrgyCertificate', label: 'Barangay Certificate', desc: 'Residency or Business cert' },
              { id: 'hasCoopMembership', label: 'Cooperative Member', desc: 'Active member of a coop' }
            ].map((item) => (
              <label key={item.id} className="flex items-start p-4 border rounded-xl gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 w-5 h-5 text-blue-600"
                  checked={(formData as any)[item.id]}
                  onChange={(e) => setFormData({...formData, [item.id]: e.target.checked})}
                />
                <div>
                  <p className="font-bold">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={handleSubmitProfile}
            disabled={loading}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Check My Score'}
          </button>
          {error && <p className="text-red-500 text-center">{error}</p>}
        </div>
      )}

      {step === 4 && result && (
        <div className="text-center space-y-6 animate-in fade-in duration-500">
          {result.tier > 0 ? (
            <>
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={40} />
              </div>
              <h1 className="text-3xl font-bold text-green-600">Credit Approved!</h1>
              <div className="bg-gray-50 p-6 rounded-2xl">
                <p className="text-gray-500 mb-1">Your Score</p>
                <div className="text-5xl font-black text-blue-600 mb-2">{result.totalScore}</div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${result.tier === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                  {result.tierLabel}
                </div>
              </div>
              <p className="text-xl">You can borrow up to <b>₱{result.borrowLimit}</b></p>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold"
              >
                Go to Dashboard
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mx-auto">
                <ChartBar size={40} />
              </div>
              <h1 className="text-3xl font-bold">Almost there!</h1>
              <div className="bg-gray-50 p-6 rounded-2xl">
                <p className="text-gray-500 mb-1">Your Score</p>
                <div className="text-5xl font-black text-gray-400 mb-2">{result.totalScore}</div>
                <p className="text-sm font-medium">You need 40 points to qualify.</p>
              </div>
              
              <div className="text-left space-y-4">
                <p className="font-bold">Next steps to improve:</p>
                {result.gapToNextTier?.suggestions.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-blue-600 rounded-full" />
                    {s.label} (+{s.points} pts)
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold"
              >
                Update Profile
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
