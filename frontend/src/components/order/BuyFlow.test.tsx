import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BuyFlow } from "./BuyFlow";
import { Product, ProductCategory, ProductStatus, TokenType } from "@/lib/types";

// Mock wagmi
vi.mock("wagmi", () => ({
  useWriteContract: () => ({
    writeContractAsync: vi.fn().mockResolvedValue("0xtxhash"),
    isPending: false,
  }),
  useReadContract: vi.fn(() => ({
    data: undefined,
    isLoading: false,
  })),
  useWaitForTransactionReceipt: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useEscrowContract", () => ({
  useEscrowContract: () => ({
    approveToken: vi.fn().mockResolvedValue("0xhash"),
    createOrder: vi.fn().mockResolvedValue("0xhash"),
    isPending: false,
    getTokenAddress: vi.fn(),
  }),
}));

vi.mock("@/stores/notificationStore", () => ({
  useNotificationStore: () => ({
    addNotification: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/config", () => ({
  CONTRACTS: { escrow: "0xEscrow" },
  TOKENS: { USDT: "0xUSDT", USDC: "0xUSDC" },
  PLATFORM_FEE_BPS: 200,
  BPS_DENOMINATOR: 10000,
}));

vi.mock("viem", () => ({
  parseUnits: (v: string) => BigInt(Math.floor(Number(v) * 1e18)),
}));

const mockProduct: Product = {
  id: "prod-1",
  seller_wallet: "0x1234567890abcdef1234567890abcdef12345678",
  title_preview: "Test Product",
  description_preview: "A product",
  category: ProductCategory.DATA,
  price_usdt: 100,
  stock: 10,
  total_sold: 5,
  product_hash: "0xabc123",
  status: ProductStatus.ACTIVE,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("BuyFlow", () => {
  const defaultProps = {
    product: mockProduct,
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  it("renders nothing when closed", () => {
    const { container } = render(<BuyFlow {...defaultProps} open={false} />);
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders Purchase Product title when open", () => {
    render(<BuyFlow {...defaultProps} />);
    expect(screen.getByText("Purchase Product")).toBeDefined();
  });

  it("shows product title in summary", () => {
    render(<BuyFlow {...defaultProps} />);
    expect(screen.getByText("Test Product")).toBeDefined();
  });

  it("shows price in summary", () => {
    render(<BuyFlow {...defaultProps} />);
    expect(screen.getByText("$100")).toBeDefined();
  });

  it("shows platform fee", () => {
    render(<BuyFlow {...defaultProps} />);
    expect(screen.getByText("Platform Fee (2%)")).toBeDefined();
    expect(screen.getByText("$2.00")).toBeDefined();
  });

  it("shows total with fee", () => {
    render(<BuyFlow {...defaultProps} />);
    expect(screen.getByText("$102.00")).toBeDefined();
  });

  it("shows token select in initial step", () => {
    render(<BuyFlow {...defaultProps} />);
    expect(screen.getByText("Payment Token")).toBeDefined();
    expect(screen.getByText("Continue")).toBeDefined();
  });

  it("advances to approve step when Continue is clicked", () => {
    render(<BuyFlow {...defaultProps} />);
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText(/Step 1: Approve/)).toBeDefined();
  });

  it("shows approve button with token and amount", () => {
    render(<BuyFlow {...defaultProps} />);
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText(/Approve 102.00 USDT/)).toBeDefined();
  });
});
