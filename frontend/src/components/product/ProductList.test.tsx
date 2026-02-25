import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductList } from "./ProductList";
import { Product, ProductCategory, ProductStatus } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeProduct = (id: string): Product => ({
  id,
  seller_wallet: "0x1234567890abcdef1234567890abcdef12345678",
  title_preview: `Product ${id}`,
  description_preview: null,
  category: ProductCategory.DATA,
  price_usdt: 10,
  stock: 1,
  total_sold: 0,
  product_hash: "0xabc",
  status: ProductStatus.ACTIVE,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
});

describe("ProductList", () => {
  it("shows spinner when loading", () => {
    const { container } = render(<ProductList products={[]} loading={true} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows empty message when no products", () => {
    render(<ProductList products={[]} />);
    expect(screen.getByText("No products found")).toBeDefined();
  });

  it("renders product cards", () => {
    const products = [makeProduct("1"), makeProduct("2")];
    render(<ProductList products={products} />);
    expect(screen.getByText("Product 1")).toBeDefined();
    expect(screen.getByText("Product 2")).toBeDefined();
  });

  it("renders pagination when totalPages > 1", () => {
    const products = [makeProduct("1")];
    render(
      <ProductList
        products={products}
        totalPages={3}
        currentPage={2}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByText("Previous")).toBeDefined();
    expect(screen.getByText("Next")).toBeDefined();
    expect(screen.getByText("2 / 3")).toBeDefined();
  });

  it("does not render pagination when totalPages is 1", () => {
    const products = [makeProduct("1")];
    render(<ProductList products={products} totalPages={1} />);
    expect(screen.queryByText("Previous")).toBeNull();
  });

  it("calls onPageChange with next page", () => {
    const onPageChange = vi.fn();
    render(
      <ProductList
        products={[makeProduct("1")]}
        totalPages={3}
        currentPage={1}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with previous page", () => {
    const onPageChange = vi.fn();
    render(
      <ProductList
        products={[makeProduct("1")]}
        totalPages={3}
        currentPage={2}
        onPageChange={onPageChange}
      />
    );
    fireEvent.click(screen.getByText("Previous"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables Previous on first page", () => {
    render(
      <ProductList
        products={[makeProduct("1")]}
        totalPages={3}
        currentPage={1}
        onPageChange={() => {}}
      />
    );
    const prevBtn = screen.getByText("Previous");
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables Next on last page", () => {
    render(
      <ProductList
        products={[makeProduct("1")]}
        totalPages={3}
        currentPage={3}
        onPageChange={() => {}}
      />
    );
    const nextBtn = screen.getByText("Next");
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
