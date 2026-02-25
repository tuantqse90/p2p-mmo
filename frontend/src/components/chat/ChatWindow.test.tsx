import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatWindow } from "./ChatWindow";

// Mutable mock state
let mockHasKeys = false;

vi.mock("@/hooks/useEncryption", () => ({
  useEncryption: () => ({
    encrypt: vi.fn(() => ({ ciphertext: "enc", nonce: "n" })),
    decrypt: vi.fn(() => "decrypted"),
    hasKeys: mockHasKeys,
    publicKey: mockHasKeys ? "mypubkey" : null,
  }),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({
    walletAddress: "0xmyaddress",
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ items: [] }),
    post: vi.fn().mockResolvedValue({}),
  },
}));

describe("ChatWindow", () => {
  beforeEach(() => {
    mockHasKeys = false;
  });

  it("shows sign in message when no keys", () => {
    render(<ChatWindow orderId="order-1" counterpartyPublicKey="key123" />);
    expect(screen.getByText("Sign in to use encrypted chat")).toBeDefined();
  });

  it("shows counterparty key missing message when has keys but no counterparty", () => {
    mockHasKeys = true;
    render(<ChatWindow orderId="order-1" counterpartyPublicKey={null} />);
    expect(
      screen.getByText(/Counterparty has not registered/)
    ).toBeDefined();
  });

  it("renders chat UI when both keys exist", () => {
    mockHasKeys = true;
    render(<ChatWindow orderId="order-1" counterpartyPublicKey="key123" />);
    expect(screen.getByText("Encrypted Chat")).toBeDefined();
    expect(screen.getByPlaceholderText("Type a message...")).toBeDefined();
    expect(screen.getByText("Send")).toBeDefined();
  });
});
