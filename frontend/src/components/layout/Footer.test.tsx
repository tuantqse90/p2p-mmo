import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders footer element", () => {
    const { container } = render(<Footer />);
    expect(container.querySelector("footer")).not.toBeNull();
  });

  it("displays platform info", () => {
    render(<Footer />);
    expect(screen.getByText("P2P Marketplace on BNB Smart Chain")).toBeDefined();
  });

  it("displays platform fee", () => {
    render(<Footer />);
    expect(screen.getByText("Platform Fee: 2%")).toBeDefined();
  });

  it("displays non-custodial info", () => {
    render(<Footer />);
    expect(screen.getByText("Non-custodial Escrow")).toBeDefined();
  });
});
