"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

export function Header() {
  const { isConnected, isAuthenticated, login, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-primary">
            P2P Market
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/marketplace"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Marketplace
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/sell"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Sell
                </Link>
                <Link
                  href="/arbitrator"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  Arbitrator
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ConnectButton showBalance={false} chainStatus="icon" />
          {isConnected && !isAuthenticated && (
            <Button size="sm" onClick={login}>
              Sign In
            </Button>
          )}
          {isAuthenticated && (
            <Button size="sm" variant="ghost" onClick={logout}>
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
