import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, OrderStatusBadge, ProductStatusBadge } from "./Badge";
import { OrderStatus, ProductStatus } from "@/lib/types";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Test Label</Badge>);
    expect(screen.getByText("Test Label")).toBeDefined();
  });

  it("applies variant styles", () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-success");
  });

  it("applies custom className", () => {
    const { container } = render(
      <Badge className="custom-class">Text</Badge>
    );
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("custom-class");
  });

  it("defaults to muted variant", () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.querySelector("span");
    expect(badge?.className).toContain("text-muted");
  });
});

describe("OrderStatusBadge", () => {
  it("renders all order statuses", () => {
    const statuses = Object.values(OrderStatus);
    for (const status of statuses) {
      const { unmount } = render(<OrderStatusBadge status={status} />);
      // Each status should render without error
      unmount();
    }
  });

  it("renders correct label for CREATED", () => {
    render(<OrderStatusBadge status={OrderStatus.CREATED} />);
    expect(screen.getByText("Created")).toBeDefined();
  });

  it("renders correct label for COMPLETED", () => {
    render(<OrderStatusBadge status={OrderStatus.COMPLETED} />);
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("renders correct label for DISPUTED", () => {
    render(<OrderStatusBadge status={OrderStatus.DISPUTED} />);
    expect(screen.getByText("Disputed")).toBeDefined();
  });

  it("renders correct label for SELLER_CONFIRMED", () => {
    render(<OrderStatusBadge status={OrderStatus.SELLER_CONFIRMED} />);
    expect(screen.getByText("Seller Confirmed")).toBeDefined();
  });
});

describe("ProductStatusBadge", () => {
  it("renders all product statuses", () => {
    const statuses = Object.values(ProductStatus);
    for (const status of statuses) {
      const { unmount } = render(<ProductStatusBadge status={status} />);
      unmount();
    }
  });

  it("renders ACTIVE status", () => {
    render(<ProductStatusBadge status={ProductStatus.ACTIVE} />);
    expect(screen.getByText("active")).toBeDefined();
  });
});
