import { describe, it, expect } from "vitest";
import {
  ProductCategory,
  ProductStatus,
  TokenType,
  OrderStatus,
  EvidenceType,
} from "./types";

describe("enums", () => {
  it("ProductCategory has all values", () => {
    expect(Object.values(ProductCategory)).toEqual([
      "data",
      "accounts",
      "tools",
      "services",
      "other",
    ]);
  });

  it("ProductStatus has all values", () => {
    expect(Object.values(ProductStatus)).toEqual([
      "active",
      "paused",
      "sold_out",
      "deleted",
    ]);
  });

  it("TokenType has USDT and USDC", () => {
    expect(TokenType.USDT).toBe("USDT");
    expect(TokenType.USDC).toBe("USDC");
  });

  it("OrderStatus has all lifecycle states", () => {
    const statuses = Object.values(OrderStatus);
    expect(statuses).toContain("created");
    expect(statuses).toContain("seller_confirmed");
    expect(statuses).toContain("completed");
    expect(statuses).toContain("disputed");
    expect(statuses).toContain("resolved_buyer");
    expect(statuses).toContain("resolved_seller");
    expect(statuses).toContain("cancelled");
    expect(statuses).toContain("expired");
    expect(statuses).toHaveLength(8);
  });

  it("EvidenceType has all values", () => {
    expect(Object.values(EvidenceType)).toEqual([
      "screenshot",
      "conversation",
      "product_proof",
      "other",
    ]);
  });
});
