import { describe, it, expect, vi } from "vitest";

// Mock external dependencies
vi.mock("@rainbow-me/rainbowkit", () => ({
  getDefaultConfig: vi.fn((cfg: Record<string, unknown>) => ({
    ...cfg,
    _type: "wagmi-config",
  })),
}));

vi.mock("wagmi/chains", () => ({
  bsc: { id: 56, name: "BNB Smart Chain" },
  bscTestnet: { id: 97, name: "BNB Smart Chain Testnet" },
}));

describe("wagmi config", () => {
  it("exports a config object", async () => {
    const { config } = await import("./wagmi");
    expect(config).toBeDefined();
    expect((config as Record<string, unknown>).appName).toBe("P2P Marketplace");
  });

  it("includes BSC chains", async () => {
    const { config } = await import("./wagmi");
    const chains = (config as Record<string, unknown>).chains as { id: number }[];
    expect(chains).toHaveLength(2);
    expect(chains[0].id).toBe(56);
    expect(chains[1].id).toBe(97);
  });
});
