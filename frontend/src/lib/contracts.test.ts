import { describe, it, expect } from "vitest";
import { P2PEscrowABI, ERC20ABI } from "./contracts";

describe("P2PEscrowABI", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(P2PEscrowABI)).toBe(true);
    expect(P2PEscrowABI.length).toBeGreaterThan(0);
  });

  it("includes createOrder function", () => {
    const fn = P2PEscrowABI.find(
      (item) => item.type === "function" && item.name === "createOrder"
    );
    expect(fn).toBeDefined();
  });

  it("includes sellerConfirmDelivery function", () => {
    const fn = P2PEscrowABI.find(
      (item) => item.type === "function" && item.name === "sellerConfirmDelivery"
    );
    expect(fn).toBeDefined();
  });

  it("includes buyerConfirmReceived function", () => {
    const fn = P2PEscrowABI.find(
      (item) => item.type === "function" && item.name === "buyerConfirmReceived"
    );
    expect(fn).toBeDefined();
  });

  it("includes cancelOrder function", () => {
    const fn = P2PEscrowABI.find(
      (item) => item.type === "function" && item.name === "cancelOrder"
    );
    expect(fn).toBeDefined();
  });

  it("includes openDispute function", () => {
    const fn = P2PEscrowABI.find(
      (item) => item.type === "function" && item.name === "openDispute"
    );
    expect(fn).toBeDefined();
  });

  it("includes resolveDispute function", () => {
    const fn = P2PEscrowABI.find(
      (item) => item.type === "function" && item.name === "resolveDispute"
    );
    expect(fn).toBeDefined();
  });

  it("includes OrderCreated event", () => {
    const evt = P2PEscrowABI.find(
      (item) => item.type === "event" && item.name === "OrderCreated"
    );
    expect(evt).toBeDefined();
  });

  it("includes OrderCompleted event", () => {
    const evt = P2PEscrowABI.find(
      (item) => item.type === "event" && item.name === "OrderCompleted"
    );
    expect(evt).toBeDefined();
  });

  it("includes getOrder view function", () => {
    const fn = P2PEscrowABI.find(
      (item) => item.type === "function" && item.name === "getOrder"
    );
    expect(fn).toBeDefined();
    expect(fn?.stateMutability).toBe("view");
  });
});

describe("ERC20ABI", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(ERC20ABI)).toBe(true);
    expect(ERC20ABI.length).toBeGreaterThan(0);
  });

  it("includes approve function", () => {
    const fn = ERC20ABI.find(
      (item) => item.type === "function" && item.name === "approve"
    );
    expect(fn).toBeDefined();
  });

  it("includes balanceOf function", () => {
    const fn = ERC20ABI.find(
      (item) => item.type === "function" && item.name === "balanceOf"
    );
    expect(fn).toBeDefined();
  });

  it("includes allowance function", () => {
    const fn = ERC20ABI.find(
      (item) => item.type === "function" && item.name === "allowance"
    );
    expect(fn).toBeDefined();
  });

  it("includes decimals function", () => {
    const fn = ERC20ABI.find(
      (item) => item.type === "function" && item.name === "decimals"
    );
    expect(fn).toBeDefined();
  });
});
