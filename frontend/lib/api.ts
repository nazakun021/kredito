// frontend/lib/api.ts

import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { useWalletStore } from '../store/walletStore';
import { signTx } from './freighter';
import { toast } from 'sonner';

type LoanAction = 'borrow' | 'repay';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/',
  timeout: 15000,
});

async function signAndSubmitWithFreighter(
  unsignedXdr: string | string[],
  action: LoanAction,
  step?: string,
) {
  const unsignedTransactions = Array.isArray(unsignedXdr) ? unsignedXdr : [unsignedXdr];
  const publicKey = useWalletStore.getState().publicKey;
  if (!publicKey) throw new Error('Wallet not connected');

  const signedResults = await Promise.all(
    unsignedTransactions.map((xdr) => signTx(xdr, publicKey)),
  );

  const signedInnerXdr = signedResults.map((result) => {
    if ('error' in result) throw new Error(result.error);
    return result.signedXdr;
  });

  return api.post('tx/sign-and-submit', {
    signedInnerXdr,
    flow: { action, step },
  });
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  async (response) => {
    const user = useAuthStore.getState().user;
    const url = response.config.url ?? '';

    if (
      user?.isExternal &&
      response.data?.requiresSignature &&
      (url.includes('/loan/borrow') || url.includes('/loan/repay'))
    ) {
      toast.info('Signature required in Freighter');
      const action: LoanAction = url.includes('/loan/borrow') ? 'borrow' : 'repay';

      if (action === 'repay' && response.data.step === 'approve') {
        await signAndSubmitWithFreighter(response.data.unsignedXdr, 'repay', 'approve');
        toast.info('Approval confirmed. Complete the on-chain repayment now.');
        const repayResponse = await api.post('loan/repay');
        response.data = repayResponse.data;
        return response;
      }

      const submitResponse = await signAndSubmitWithFreighter(
        response.data.unsignedXdr,
        action,
        response.data.step,
      );

      if (action === 'repay') {
        response.data = {
          ...submitResponse.data,
        };
        return response;
      }

      response.data = {
        ...response.data.meta,
        ...submitResponse.data,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    return response;
  },
  async (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/?session=expired';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
