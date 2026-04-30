import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { useWalletStore } from '../store/walletStore';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/",
  timeout: 90000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      useWalletStore.getState().disconnect();
      if (typeof window !== 'undefined') {
        window.location.href = '/?session=expired';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
