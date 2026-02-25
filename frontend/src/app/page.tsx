"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Notifications } from "@/components/layout/Notifications";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const { isConnected, isAuthenticated, login } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Notifications />

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-primary">P2P</span> Marketplace
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto">
            Non-custodial escrow marketplace on BNB Smart Chain.
            Buy and sell digital products with end-to-end encryption
            and on-chain dispute resolution.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            {!isConnected ? (
              <ConnectButton />
            ) : !isAuthenticated ? (
              <Button size="lg" onClick={login}>
                Sign In with Wallet
              </Button>
            ) : (
              <>
                <Link href="/marketplace">
                  <Button size="lg">Browse Marketplace</Button>
                </Link>
                <Link href="/sell">
                  <Button size="lg" variant="secondary">
                    Start Selling
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="text-2xl mb-3">&#x1f512;</div>
            <h3 className="font-semibold mb-2">Non-Custodial Escrow</h3>
            <p className="text-sm text-muted">
              Funds locked in smart contracts. No middleman holds your money.
            </p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="text-2xl mb-3">&#x1f510;</div>
            <h3 className="font-semibold mb-2">E2E Encryption</h3>
            <p className="text-sm text-muted">
              Product keys and messages encrypted with NaCl. Only buyer
              and seller can read them.
            </p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="text-2xl mb-3">&#x2696;</div>
            <h3 className="font-semibold mb-2">On-Chain Disputes</h3>
            <p className="text-sm text-muted">
              Independent arbitrators resolve disputes with transparent
              reputation tracking.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
