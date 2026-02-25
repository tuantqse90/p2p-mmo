import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderCard } from "./OrderCard";
import { Order, OrderStatus, TokenType } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockOrder: Order = {
  id: "order-1",
  onchain_order_id: 42,
  chain: "bsc",
  buyer_wallet: "0xBuyerBuyerBuyerBuyerBuyerBuyerBuyerBuyer",
  seller_wallet: "0xSellerSellerSellerSellerSellerSellerSeller",
  arbitrator_wallet: null,
  product_id: "prod-1",
  token: TokenType.USDT,
  amount: 100,
  platform_fee: 2,
  status: OrderStatus.CREATED,
  product_key_encrypted: null,
  tx_hash_create: "0xabc",
  tx_hash_complete: null,
  seller_confirmed_at: null,
  dispute_opened_at: null,
  dispute_deadline: null,
  completed_at: null,
  created_at: "2024-06-15T12:00:00Z",
  updated_at: "2024-06-15T12:00:00Z",
};

describe("OrderCard", () => {
  it("renders as buyer with Purchase label", () => {
    render(<OrderCard order={mockOrder} role="buyer" />);
    expect(screen.getByText("Purchase")).toBeDefined();
  });

  it("renders as seller with Sale label", () => {
    render(<OrderCard order={mockOrder} role="seller" />);
    expect(screen.getByText("Sale")).toBeDefined();
  });

  it("shows amount and token", () => {
    render(<OrderCard order={mockOrder} role="buyer" />);
    expect(screen.getByText("100 USDT")).toBeDefined();
  });

  it("shows seller address when role is buyer", () => {
    render(<OrderCard order={mockOrder} role="buyer" />);
    expect(screen.getByText("Seller")).toBeDefined();
  });

  it("shows buyer address when role is seller", () => {
    render(<OrderCard order={mockOrder} role="seller" />);
    expect(screen.getByText("Buyer")).toBeDefined();
  });

  it("shows on-chain ID when present", () => {
    render(<OrderCard order={mockOrder} role="buyer" />);
    expect(screen.getByText("#42")).toBeDefined();
  });

  it("hides on-chain ID when null", () => {
    const order = { ...mockOrder, onchain_order_id: null };
    render(<OrderCard order={order} role="buyer" />);
    expect(screen.queryByText("On-chain ID")).toBeNull();
  });

  it("shows created date", () => {
    render(<OrderCard order={mockOrder} role="buyer" />);
    const dateEl = screen.getByText(new Date("2024-06-15T12:00:00Z").toLocaleDateString());
    expect(dateEl).toBeDefined();
  });

  it("links to order detail page", () => {
    const { container } = render(<OrderCard order={mockOrder} role="buyer" />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/orders/order-1");
  });
});
