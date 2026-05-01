import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { useWalletStore } from '../store/walletStore';
import { loginWithFreighter } from './freighter';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
  timeout: 90000,
});

let reauthPromise: Promise<string | null> | null = null;

async function ensureWalletAuthToken() {
  const currentToken = useAuthStore.getState().token;
  if (currentToken) {
    return currentToken;
  }

  const { isConnected } = useWalletStore.getState();
  if (!isConnected) {
    return null;
  }

  if (!reauthPromise) {
    reauthPromise = loginWithFreighter()
      .then((data) => {
        useAuthStore.getState().setAuth({ wallet: data.wallet }, data.token);
        return data.token;
      })
      .catch(() => {
        useAuthStore.getState().clearAuth();
        return null;
      })
      .finally(() => {
        reauthPromise = null;
      });
  }

  return reauthPromise;
}

api.interceptors.request.use((config) => {
  if (config.headers) {
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
  }

  const url = config.url ?? '';
  const isAuthRoute = url.includes('/auth/challenge') || url.includes('/auth/login');

  if (isAuthRoute) {
    return config;
  }

  return ensureWalletAuthToken().then((token) => {
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;
    const url = typeof originalRequest?.url === 'string' ? originalRequest.url : '';
    const isAuthRoute = url.includes('/auth/challenge') || url.includes('/auth/login');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true;
      const refreshedToken = await ensureWalletAuthToken();

      if (refreshedToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return api(originalRequest);
      }

      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('kredito-auth');
        window.location.href = '/?session=expired';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
