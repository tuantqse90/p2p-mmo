import { bsc, bscTestnet } from "wagmi/chains";
import { http } from "wagmi";

export const SUPPORTED_CHAINS = [bsc, bscTestnet] as const;

export const TRANSPORTS = {
  [bsc.id]: http(),
  [bscTestnet.id]: http(),
};

export const BSC_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_BSC_CHAIN_ID || "56"
);

export const CONTRACTS = {
  escrow: process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`,
  arbitratorPool: process.env
    .NEXT_PUBLIC_ARBITRATOR_POOL_ADDRESS as `0x${string}`,
};

export const TOKENS = {
  USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`,
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export const PLATFORM_FEE_BPS = 200;
export const ARB_FEE_BPS = 500;
export const BPS_DENOMINATOR = 10_000;
