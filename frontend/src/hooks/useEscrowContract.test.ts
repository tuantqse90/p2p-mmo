import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEscrowContract } from "./useEscrowContract";

// Mock wagmi
const mockWriteContractAsync = vi.fn().mockResolvedValue("0xtxhash");
vi.mock("wagmi", () => ({
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
    isPending: false,
  }),
  useReadContract: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
}));

// Mock viem
vi.mock("viem", () => ({
  parseUnits: (value: string, decimals: number) => BigInt(Math.floor(Number(value) * (10 ** decimals))),
}));

// Mock contracts
vi.mock("@/lib/contracts", () => ({
  P2PEscrowABI: [{ type: "function", name: "createOrder" }],
  ERC20ABI: [{ type: "function", name: "approve" }],
}));

// Mock config
vi.mock("@/lib/config", () => ({
  CONTRACTS: {
    escrow: "0xEscrowAddress" as `0x${string}`,
    arbitratorPool: "0xPoolAddress" as `0x${string}`,
  },
  TOKENS: {
    USDT: "0xUSDTAddress" as `0x${string}`,
    USDC: "0xUSDCAddress" as `0x${string}`,
  },
}));

vi.mock("@/stores/notificationStore", () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
  }),
}));

// Need to import after mocks
const { TokenType } = await import("@/lib/types");

describe("useEscrowContract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTokenAddress returns USDT address for USDT", () => {
    const { result } = renderHook(() => useEscrowContract());
    expect(result.current.getTokenAddress(TokenType.USDT)).toBe("0xUSDTAddress");
  });

  it("getTokenAddress returns USDC address for USDC", () => {
    const { result } = renderHook(() => useEscrowContract());
    expect(result.current.getTokenAddress(TokenType.USDC)).toBe("0xUSDCAddress");
  });

  it("approveToken calls writeContractAsync", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.approveToken(TokenType.USDT, BigInt(1000));
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0xUSDTAddress",
        functionName: "approve",
      })
    );
  });

  it("createOrder calls writeContractAsync with correct args", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.createOrder(
        "0xSeller" as `0x${string}`,
        TokenType.USDT,
        BigInt(1000),
        "0xProductHash" as `0x${string}`
      );
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0xEscrowAddress",
        functionName: "createOrder",
        args: ["0xSeller", "0xUSDTAddress", BigInt(1000), "0xProductHash"],
      })
    );
  });

  it("sellerConfirmDelivery calls writeContractAsync", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.sellerConfirmDelivery(BigInt(1));
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "sellerConfirmDelivery",
        args: [BigInt(1)],
      })
    );
  });

  it("buyerConfirmReceived calls writeContractAsync", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.buyerConfirmReceived(BigInt(1));
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "buyerConfirmReceived",
        args: [BigInt(1)],
      })
    );
  });

  it("cancelOrder calls writeContractAsync", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.cancelOrder(BigInt(1));
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "cancelOrder",
        args: [BigInt(1)],
      })
    );
  });

  it("openDispute calls writeContractAsync", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.openDispute(BigInt(1), "QmEvidence");
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "openDispute",
        args: [BigInt(1), "QmEvidence"],
      })
    );
  });

  it("submitEvidence calls writeContractAsync", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.submitEvidence(BigInt(1), "QmHash");
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "submitEvidence",
        args: [BigInt(1), "QmHash"],
      })
    );
  });

  it("resolveDispute calls writeContractAsync", async () => {
    const { result } = renderHook(() => useEscrowContract());
    await act(async () => {
      await result.current.resolveDispute(BigInt(1), true);
    });
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "resolveDispute",
        args: [BigInt(1), true],
      })
    );
  });

  it("isPending reflects contract state", () => {
    const { result } = renderHook(() => useEscrowContract());
    expect(result.current.isPending).toBe(false);
  });

  it("parseAmount converts string to bigint", () => {
    const { result } = renderHook(() => useEscrowContract());
    const amount = result.current.parseAmount("10", 18);
    expect(typeof amount).toBe("bigint");
  });
});
