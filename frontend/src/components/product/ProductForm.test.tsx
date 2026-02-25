import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProductForm } from "./ProductForm";

// Mock viem's keccak256 and toBytes
vi.mock("viem", () => ({
  keccak256: () => "0xmockhash",
  toBytes: (s: string) => new TextEncoder().encode(s),
}));

describe("ProductForm", () => {
  it("renders create listing title", () => {
    render(<ProductForm onSubmit={async () => {}} />);
    expect(screen.getByText("Create New Listing")).toBeDefined();
  });

  it("renders all form fields", () => {
    render(<ProductForm onSubmit={async () => {}} />);
    expect(screen.getByLabelText("Title")).toBeDefined();
    expect(screen.getByText("Description")).toBeDefined();
    expect(screen.getByLabelText("Category")).toBeDefined();
    expect(screen.getByLabelText("Price (USDT)")).toBeDefined();
    expect(screen.getByLabelText("Stock")).toBeDefined();
  });

  it("renders submit button", () => {
    render(<ProductForm onSubmit={async () => {}} />);
    expect(screen.getByText("Create Listing")).toBeDefined();
  });

  it("shows title error on empty submit", async () => {
    render(<ProductForm onSubmit={async () => {}} />);
    fireEvent.click(screen.getByText("Create Listing"));
    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeDefined();
    });
  });

  it("shows price error on invalid price", async () => {
    render(<ProductForm onSubmit={async () => {}} />);
    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "My Product" } });
    fireEvent.click(screen.getByText("Create Listing"));
    await waitFor(() => {
      expect(screen.getByText("Price must be greater than 0")).toBeDefined();
    });
  });

  it("calls onSubmit with valid data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm onSubmit={onSubmit} />);

    // Fill title
    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Test Product" } });

    // Fill price
    const priceInput = screen.getByLabelText("Price (USDT)");
    fireEvent.change(priceInput, { target: { value: "25" } });

    // Fill stock
    const stockInput = screen.getByLabelText("Stock");
    fireEvent.change(stockInput, { target: { value: "10" } });

    // Submit the form directly
    const form = screen.getByText("Create Listing").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title_preview: "Test Product",
      price_usdt: 25,
      stock: 10,
    });
  });

  it("shows loading state on button", () => {
    render(<ProductForm onSubmit={async () => {}} loading={true} />);
    const btn = screen.getByText("Create Listing").closest("button");
    expect(btn?.disabled).toBe(true);
  });
});
