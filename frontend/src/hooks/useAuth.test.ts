import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "./useAuth";

// Mock wagmi
const mockAddress = "0x1234567890abcdef1234567890abcdef12345678";
const mockSignMessageAsync = vi.fn();
const mockDisconnect = vi.fn();
let mockIsConnected = false;

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockIsConnected ? mockAddress : undefined,
    isConnected: mockIsConnected,
  }),
  useSignMessage: () => ({
    signMessageAsync: mockSignMessageAsync,
  }),
  useDisconnect: () => ({
    disconnect: mockDisconnect,
  }),
}));

// Mock auth store
const mockSetAuth = vi.fn();
const mockSetEncryptionKeys = vi.fn();
const mockStoreLogout = vi.fn();
let mockToken: string | null = null;
let mockWalletAddress: string | null = null;

vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({
    token: mockToken,
    walletAddress: mockWalletAddress,
    setAuth: mockSetAuth,
    setEncryptionKeys: mockSetEncryptionKeys,
    logout: mockStoreLogout,
  }),
}));

// Mock notification store
const mockAddNotification = vi.fn();
vi.mock("@/stores/notificationStore", () => ({
  useNotificationStore: () => ({
    addNotification: mockAddNotification,
  }),
}));

// Mock API
vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn().mockImplementation((path: string) => {
      if (path === "/auth/nonce") {
        return Promise.resolve({ nonce: "abc123", message: "Sign this" });
      }
      if (path === "/auth/verify") {
        return Promise.resolve({
          token: "jwt-token",
          expires_at: "2025-01-01",
          wallet_address: mockAddress,
        });
      }
      return Promise.resolve({});
    }),
  },
}));

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  deriveKeyPair: vi.fn(() => ({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(64),
  })),
  publicKeyToBase64: vi.fn(() => "publicKeyB64"),
}));

vi.mock("tweetnacl-util", () => ({
  encodeBase64: vi.fn(() => "secretKeyB64"),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected = false;
    mockToken = null;
    mockWalletAddress = null;
  });

  it("returns isConnected false when wallet not connected", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("returns isConnected true when wallet connected", () => {
    mockIsConnected = true;
    const { result } = renderHook(() => useAuth());
    expect(result.current.isConnected).toBe(true);
  });

  it("returns isAuthenticated true when token exists", () => {
    mockToken = "jwt-token";
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("returns walletAddress from store", () => {
    mockWalletAddress = "0xabc";
    const { result } = renderHook(() => useAuth());
    expect(result.current.walletAddress).toBe("0xabc");
  });

  it("login performs full auth flow", async () => {
    mockIsConnected = true;
    mockSignMessageAsync.mockResolvedValue("0xsignature");

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login();
    });

    expect(mockSetAuth).toHaveBeenCalledWith("jwt-token", mockAddress);
    expect(mockSetEncryptionKeys).toHaveBeenCalledWith(
      "publicKeyB64",
      "secretKeyB64"
    );
    expect(mockAddNotification).toHaveBeenCalledWith(
      "success",
      "Signed in successfully"
    );
  });

  it("logout disconnects and notifies", () => {
    mockIsConnected = true;
    mockToken = "jwt-token";
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(mockStoreLogout).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockAddNotification).toHaveBeenCalledWith("info", "Signed out");
  });

  it("auto-logout when wallet disconnects after being connected", () => {
    // Start connected with a token
    mockToken = "jwt-token";
    mockIsConnected = true;
    const { rerender } = renderHook(() => useAuth());

    // Simulate wallet disconnection
    mockIsConnected = false;
    rerender();
    expect(mockStoreLogout).toHaveBeenCalled();
  });

  it("does not auto-logout on initial mount when wallet never connected", () => {
    mockToken = "jwt-token";
    mockIsConnected = false;
    renderHook(() => useAuth());
    expect(mockStoreLogout).not.toHaveBeenCalled();
  });

  it("does not auto-logout when no token", () => {
    mockIsConnected = false;
    mockToken = null;
    renderHook(() => useAuth());
    expect(mockStoreLogout).not.toHaveBeenCalled();
  });
});
