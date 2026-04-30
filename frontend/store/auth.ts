import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  wallet: string;
  isExternal: boolean;
}

interface AuthState {
  user: AuthUser | null;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setAuth: (user) => set({ user }),
      clearAuth: () => set({ user: null }),
    }),
    {
      name: "kredito-auth",
      partialize: (state) => ({ user: state.user }), // token never touches localStorage
    },
  ),
);
