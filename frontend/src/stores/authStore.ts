import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface AuthState {
  token: string | null;
  walletAddress: string | null;
  encryptionPublicKey: string | null;
  encryptionSecretKey: string | null;
  setAuth: (token: string, walletAddress: string) => void;
  setEncryptionKeys: (publicKey: string, secretKey: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      walletAddress: null,
      encryptionPublicKey: null,
      encryptionSecretKey: null,
      setAuth: (token, walletAddress) => {
        api.setToken(token);
        set({ token, walletAddress });
      },
      setEncryptionKeys: (publicKey, secretKey) => {
        set({ encryptionPublicKey: publicKey, encryptionSecretKey: secretKey });
      },
      logout: () => {
        api.setToken(null);
        set({
          token: null,
          walletAddress: null,
          encryptionPublicKey: null,
          encryptionSecretKey: null,
        });
      },
    }),
    {
      name: "p2p-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.setToken(state.token);
        }
      },
    }
  )
);

// Expose store for E2E testing (non-production only)
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__authStore = useAuthStore;
}
