import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResolvePanel } from "./ResolvePanel";
import { Evidence, EvidenceType } from "@/lib/types";

vi.mock("@/hooks/useEscrowContract", () => ({
  useEscrowContract: () => ({
    resolveDispute: vi.fn().mockResolvedValue(undefined),
    isPending: false,
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

const mockEvidence: Evidence[] = [
  {
    id: "ev-1",
    order_id: "order-1",
    submitter_wallet: "0x1234567890abcdef1234567890abcdef12345678",
    ipfs_hash: "QmTestHash123",
    evidence_type: EvidenceType.SCREENSHOT,
    created_at: "2024-01-01T00:00:00Z",
  },
];

describe("ResolvePanel", () => {
  const defaultProps = {
    orderId: "order-1",
    onchainOrderId: 42,
    buyerWallet: "0xBuyerBuyerBuyerBuyerBuyerBuyerBuyerBuyer",
    sellerWallet: "0xSellerSellerSellerSellerSellerSellerSeller",
    evidence: [] as Evidence[],
    onResolved: vi.fn(),
  };

  it("renders Arbitrator Panel header", () => {
    render(<ResolvePanel {...defaultProps} />);
    expect(screen.getByText("Arbitrator Panel")).toBeDefined();
  });

  it("shows truncated buyer and seller addresses", () => {
    render(<ResolvePanel {...defaultProps} />);
    expect(screen.getByText("Buyer")).toBeDefined();
    expect(screen.getByText("Seller")).toBeDefined();
  });

  it("renders Favor Buyer and Favor Seller buttons", () => {
    render(<ResolvePanel {...defaultProps} />);
    expect(screen.getByText("Favor Buyer")).toBeDefined();
    expect(screen.getByText("Favor Seller")).toBeDefined();
  });

  it("does not show evidence section when empty", () => {
    render(<ResolvePanel {...defaultProps} />);
    expect(screen.queryByText("Evidence")).toBeNull();
  });

  it("shows evidence section when evidence exists", () => {
    render(<ResolvePanel {...defaultProps} evidence={mockEvidence} />);
    expect(screen.getByText("Evidence")).toBeDefined();
  });

  it("renders evidence type and submitter", () => {
    render(<ResolvePanel {...defaultProps} evidence={mockEvidence} />);
    expect(screen.getByText("screenshot")).toBeDefined();
    expect(screen.getByText(/from 0x1234/)).toBeDefined();
  });

  it("renders View link for evidence", () => {
    render(<ResolvePanel {...defaultProps} evidence={mockEvidence} />);
    const viewLink = screen.getByText("View");
    expect(viewLink.closest("a")?.getAttribute("href")).toContain("QmTestHash123");
  });
});
