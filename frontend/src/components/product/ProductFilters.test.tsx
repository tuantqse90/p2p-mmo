import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductFilters } from "./ProductFilters";
import { ProductListParams } from "@/lib/types";

const defaultFilters: ProductListParams = {};

describe("ProductFilters", () => {
  it("renders search input", () => {
    render(<ProductFilters filters={defaultFilters} onChange={() => {}} />);
    expect(screen.getByPlaceholderText("Search products...")).toBeDefined();
  });

  it("renders sort order toggle button", () => {
    render(<ProductFilters filters={defaultFilters} onChange={() => {}} />);
    // Default sort order is not 'asc', so shows desc
    expect(screen.getByText(/Desc/)).toBeDefined();
  });

  it("shows Asc when sort_order is asc", () => {
    render(
      <ProductFilters
        filters={{ sort_order: "asc" }}
        onChange={() => {}}
      />
    );
    expect(screen.getByText(/Asc/)).toBeDefined();
  });

  it("calls onChange when search input changes", () => {
    const onChange = vi.fn();
    render(<ProductFilters filters={defaultFilters} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Search products...");
    fireEvent.change(input, { target: { value: "test" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: "test", page: 1 })
    );
  });

  it("calls onChange when sort order is toggled", () => {
    const onChange = vi.fn();
    render(
      <ProductFilters filters={{ sort_order: "asc" }} onChange={onChange} />
    );
    fireEvent.click(screen.getByText(/Asc/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: "desc" })
    );
  });

  it("renders min and max price inputs", () => {
    render(<ProductFilters filters={defaultFilters} onChange={() => {}} />);
    expect(screen.getByPlaceholderText("Min $")).toBeDefined();
    expect(screen.getByPlaceholderText("Max $")).toBeDefined();
  });

  it("calls onChange when min price changes", () => {
    const onChange = vi.fn();
    render(<ProductFilters filters={defaultFilters} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Min $");
    fireEvent.change(input, { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ min_price: 10, page: 1 })
    );
  });

  it("sets min_price to undefined when cleared", () => {
    const onChange = vi.fn();
    render(<ProductFilters filters={{ min_price: 10 }} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Min $");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ min_price: undefined, page: 1 })
    );
  });
});
