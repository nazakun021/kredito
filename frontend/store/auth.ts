import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  wallet: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hydrated: false,
      setAuth: (user, token) => set({ user, token }),
      clearAuth: () => set({ user: null, token: null }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "kredito-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState> | undefined;
        const hasUser = !!persisted?.user;
        const hasToken = !!persisted?.token;

        if (hasUser !== hasToken) {
          return {
            ...currentState,
            user: null,
            token: null,
          };
        }

        return {
          ...currentState,
          ...persisted,
          hydrated: true,
        };
      },
    },
  ),
);
