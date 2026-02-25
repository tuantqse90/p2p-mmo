import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderTimeline } from "./OrderTimeline";
import { OrderStatus } from "@/lib/types";

describe("OrderTimeline", () => {
  it("shows Order Created step for CREATED status", () => {
    render(<OrderTimeline status={OrderStatus.CREATED} />);
    expect(screen.getByText("Order Created")).toBeDefined();
  });

  it("shows Seller Confirmed step for SELLER_CONFIRMED", () => {
    render(<OrderTimeline status={OrderStatus.SELLER_CONFIRMED} />);
    expect(screen.getByText("Seller Confirmed")).toBeDefined();
  });

  it("shows Completed step for COMPLETED status", () => {
    render(<OrderTimeline status={OrderStatus.COMPLETED} />);
    expect(screen.getByText("Completed")).toBeDefined();
  });

  it("shows Disputed step for DISPUTED status", () => {
    render(<OrderTimeline status={OrderStatus.DISPUTED} />);
    expect(screen.getByText("Disputed")).toBeDefined();
  });

  it("shows Resolved (Buyer wins) for RESOLVED_BUYER", () => {
    render(<OrderTimeline status={OrderStatus.RESOLVED_BUYER} />);
    expect(screen.getByText("Resolved (Buyer wins)")).toBeDefined();
  });

  it("shows Resolved (Seller wins) for RESOLVED_SELLER", () => {
    render(<OrderTimeline status={OrderStatus.RESOLVED_SELLER} />);
    expect(screen.getByText("Resolved (Seller wins)")).toBeDefined();
  });

  it("shows Cancelled for CANCELLED status", () => {
    render(<OrderTimeline status={OrderStatus.CANCELLED} />);
    expect(screen.getByText("Cancelled")).toBeDefined();
  });

  it("shows Expired for EXPIRED status", () => {
    render(<OrderTimeline status={OrderStatus.EXPIRED} />);
    expect(screen.getByText("Expired")).toBeDefined();
  });

  it("renders all lifecycle statuses without error", () => {
    for (const status of Object.values(OrderStatus)) {
      const { unmount } = render(<OrderTimeline status={status} />);
      unmount();
    }
  });
});
