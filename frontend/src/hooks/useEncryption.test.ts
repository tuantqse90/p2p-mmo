import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEncryption } from "./useEncryption";

// Mock auth store
const mockStore = {
  encryptionPublicKey: null as string | null,
  encryptionSecretKey: null as string | null,
};

vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => mockStore,
}));

// Mock encryption functions
const mockEncryptResult = { ciphertext: "encrypted", nonce: "nonce123" };
vi.mock("@/lib/encryption", () => ({
  encryptMessage: vi.fn(() => mockEncryptResult),
  decryptMessage: vi.fn(() => "decrypted text"),
  base64ToPublicKey: vi.fn((key: string) => new Uint8Array(32)),
}));

// Mock tweetnacl-util
vi.mock("tweetnacl-util", () => ({
  decodeBase64: vi.fn(() => new Uint8Array(32)),
}));

describe("useEncryption", () => {
  beforeEach(() => {
    mockStore.encryptionPublicKey = null;
    mockStore.encryptionSecretKey = null;
  });

  it("returns hasKeys false when not authenticated", () => {
    const { result } = renderHook(() => useEncryption());
    expect(result.current.hasKeys).toBe(false);
  });

  it("returns hasKeys true when keys are set", () => {
    mockStore.encryptionSecretKey = "secretkeybase64";
    mockStore.encryptionPublicKey = "publickeybase64";
    const { result } = renderHook(() => useEncryption());
    expect(result.current.hasKeys).toBe(true);
  });

  it("returns publicKey from store", () => {
    mockStore.encryptionPublicKey = "mypubkey";
    const { result } = renderHook(() => useEncryption());
    expect(result.current.publicKey).toBe("mypubkey");
  });

  it("encrypt throws when not authenticated", () => {
    const { result } = renderHook(() => useEncryption());
    expect(() => result.current.encrypt("hello", "recipientKey")).toThrow(
      "Not authenticated"
    );
  });

  it("encrypt works when authenticated", () => {
    mockStore.encryptionSecretKey = "secretkeybase64";
    const { result } = renderHook(() => useEncryption());
    const encrypted = result.current.encrypt("hello", "recipientKey");
    expect(encrypted).toEqual(mockEncryptResult);
  });

  it("decrypt throws when not authenticated", () => {
    const { result } = renderHook(() => useEncryption());
    expect(() =>
      result.current.decrypt("cipher", "nonce", "senderKey")
    ).toThrow("Not authenticated");
  });

  it("decrypt works when authenticated", () => {
    mockStore.encryptionSecretKey = "secretkeybase64";
    const { result } = renderHook(() => useEncryption());
    const decrypted = result.current.decrypt("cipher", "nonce", "senderKey");
    expect(decrypted).toBe("decrypted text");
  });
});
