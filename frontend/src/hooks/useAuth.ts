"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { api } from "@/lib/api";
import { deriveKeyPair, publicKeyToBase64 } from "@/lib/encryption";
import { encodeBase64 } from "tweetnacl-util";

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { token, walletAddress, setAuth, setEncryptionKeys, logout } =
    useAuthStore();
  const { addNotification } = useNotificationStore();
  const wasConnectedRef = useRef(false);

  const login = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");

    // 1. Request nonce
    const { nonce: _nonce, message } = await api.post<{
      nonce: string;
      message: string;
    }>("/auth/nonce", { wallet_address: address });

    // 2. Sign message
    const signature = await signMessageAsync({ message });

    // 3. Derive encryption keypair from signature
    const keyPair = deriveKeyPair(signature);
    const publicKeyB64 = publicKeyToBase64(keyPair.publicKey);

    // 4. Verify with backend
    const { token: jwt } = await api.post<{
      token: string;
      expires_at: string;
      wallet_address: string;
    }>("/auth/verify", {
      wallet_address: address,
      signature,
      public_key: publicKeyB64,
    });

    // 5. Set auth state
    setAuth(jwt, address);
    setEncryptionKeys(publicKeyB64, encodeBase64(keyPair.secretKey));

    addNotification("success", "Signed in successfully");
  }, [address, signMessageAsync, setAuth, setEncryptionKeys, addNotification]);

  const handleLogout = useCallback(() => {
    logout();
    disconnect();
    addNotification("info", "Signed out");
  }, [logout, disconnect, addNotification]);

  // Track if wallet was ever connected in this session
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true;
    }
  }, [isConnected]);

  // Auto-logout only when wallet actively disconnects (not on initial hydration)
  useEffect(() => {
    if (wasConnectedRef.current && !isConnected && token) {
      logout();
    }
  }, [isConnected, token, logout]);

  return {
    address,
    isConnected,
    isAuthenticated: !!token,
    walletAddress,
    login,
    logout: handleLogout,
  };
}
