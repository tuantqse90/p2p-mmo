import { describe, it, expect } from "vitest";
import {
  PLATFORM_FEE_BPS,
  ARB_FEE_BPS,
  BPS_DENOMINATOR,
  API_URL,
  WS_URL,
} from "./config";

describe("config", () => {
  it("has correct fee constants", () => {
    expect(PLATFORM_FEE_BPS).toBe(200);
    expect(ARB_FEE_BPS).toBe(500);
    expect(BPS_DENOMINATOR).toBe(10_000);
  });

  it("calculates 2% platform fee correctly", () => {
    const amount = 100;
    const fee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    expect(fee).toBe(2);
  });

  it("calculates 5% arbitrator fee correctly", () => {
    const amount = 100;
    const fee = (amount * ARB_FEE_BPS) / BPS_DENOMINATOR;
    expect(fee).toBe(5);
  });

  it("has default API_URL", () => {
    expect(API_URL).toBeTruthy();
    expect(typeof API_URL).toBe("string");
  });

  it("has default WS_URL", () => {
    expect(WS_URL).toBeTruthy();
    expect(typeof WS_URL).toBe("string");
  });
});
