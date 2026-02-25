import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "./ProductCard";
import { Product, ProductCategory, ProductStatus } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockProduct: Product = {
  id: "prod-1",
  seller_wallet: "0x1234567890abcdef1234567890abcdef12345678",
  title_preview: "Test Digital Product",
  description_preview: "A great product for testing",
  category: ProductCategory.DATA,
  price_usdt: 25.5,
  stock: 10,
  total_sold: 5,
  product_hash: "0xabc123",
  status: ProductStatus.ACTIVE,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("ProductCard", () => {
  it("renders product title", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("Test Digital Product")).toBeDefined();
  });

  it("renders product description", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("A great product for testing")).toBeDefined();
  });

  it("renders product price", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("$25.5")).toBeDefined();
  });

  it("renders category badge", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("Data")).toBeDefined();
  });

  it("renders stock and sold counts", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText("Stock: 10")).toBeDefined();
    expect(screen.getByText("Sold: 5")).toBeDefined();
  });

  it("renders truncated seller address", () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText(/Seller: 0x1234/)).toBeDefined();
  });

  it("links to product detail page", () => {
    const { container } = render(<ProductCard product={mockProduct} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/marketplace/prod-1");
  });

  it("handles null description", () => {
    const product = { ...mockProduct, description_preview: null };
    const { container } = render(<ProductCard product={product} />);
    expect(container.querySelector(".line-clamp-2")).toBeNull();
  });
});
