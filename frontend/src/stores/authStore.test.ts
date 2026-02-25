import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    setToken: vi.fn(),
  },
}));

import { useAuthStore } from "./authStore";
import { api } from "@/lib/api";

describe("authStore", () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      token: null,
      walletAddress: null,
      encryptionPublicKey: null,
      encryptionSecretKey: null,
    });
    vi.clearAllMocks();
  });

  it("has correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.walletAddress).toBeNull();
    expect(state.encryptionPublicKey).toBeNull();
    expect(state.encryptionSecretKey).toBeNull();
  });

  it("setAuth updates token and wallet", () => {
    useAuthStore.getState().setAuth("jwt-token-123", "0xabc123");

    const state = useAuthStore.getState();
    expect(state.token).toBe("jwt-token-123");
    expect(state.walletAddress).toBe("0xabc123");
    expect(api.setToken).toHaveBeenCalledWith("jwt-token-123");
  });

  it("setEncryptionKeys updates keys", () => {
    useAuthStore
      .getState()
      .setEncryptionKeys("public-key-b64", "secret-key-b64");

    const state = useAuthStore.getState();
    expect(state.encryptionPublicKey).toBe("public-key-b64");
    expect(state.encryptionSecretKey).toBe("secret-key-b64");
  });

  it("logout clears all state", () => {
    // First set some state
    useAuthStore.getState().setAuth("token", "wallet");
    useAuthStore.getState().setEncryptionKeys("pub", "sec");

    // Then logout
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.walletAddress).toBeNull();
    expect(state.encryptionPublicKey).toBeNull();
    expect(state.encryptionSecretKey).toBeNull();
    expect(api.setToken).toHaveBeenLastCalledWith(null);
  });

  it("setAuth calls api.setToken", () => {
    useAuthStore.getState().setAuth("new-token", "0xwallet");
    expect(api.setToken).toHaveBeenCalledWith("new-token");
  });

  it("logout calls api.setToken(null)", () => {
    useAuthStore.getState().setAuth("token", "wallet");
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    expect(api.setToken).toHaveBeenCalledWith(null);
  });
});
