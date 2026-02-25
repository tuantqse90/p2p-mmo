import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { bsc, bscTestnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "P2P Marketplace",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "placeholder",
  chains: [bsc, bscTestnet],
  ssr: true,
});
