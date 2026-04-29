import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { signWithFreighter } from './freighter';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

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
      (url.endsWith('/loan/borrow') || url.endsWith('/loan/repay'))
    ) {
      const unsignedXdr = Array.isArray(response.data.unsignedXdr)
        ? response.data.unsignedXdr
        : [response.data.unsignedXdr];
      const signedInnerXdr = await Promise.all(unsignedXdr.map((xdr: string) => signWithFreighter(xdr)));
      const submitResponse = await api.post('/tx/sign-and-submit', { signedInnerXdr });

      if (url.endsWith('/loan/repay')) {
        const refreshed = await api.post('/credit/generate');
        response.data = {
          ...response.data.meta,
          ...submitResponse.data,
          previousScore: null,
          newScore: refreshed.data.score,
          newTier: refreshed.data.tierLabel,
          newBorrowLimit: refreshed.data.borrowLimit,
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
