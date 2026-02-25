"use client";

import { useState } from "react";
import { useEscrowContract } from "@/hooks/useEscrowContract";
import { useNotificationStore } from "@/stores/notificationStore";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Evidence } from "@/lib/types";

interface ResolvePanelProps {
  orderId: string;
  onchainOrderId: number;
  buyerWallet: string;
  sellerWallet: string;
  evidence: Evidence[];
  onResolved: () => void;
}

export function ResolvePanel({
  orderId,
  onchainOrderId,
  buyerWallet,
  sellerWallet,
  evidence,
  onResolved,
}: ResolvePanelProps) {
  const [loading, setLoading] = useState(false);
  const { resolveDispute, isPending } = useEscrowContract();
  const { addNotification } = useNotificationStore();

  const handleResolve = async (favorBuyer: boolean) => {
    setLoading(true);
    try {
      // Resolve on-chain
      await resolveDispute(BigInt(onchainOrderId), favorBuyer);

      // Update backend
      await api.post(`/orders/${orderId}/resolve`, {
        favor_buyer: favorBuyer,
      });

      addNotification(
        "success",
        `Dispute resolved in favor of ${favorBuyer ? "buyer" : "seller"}`
      );
      onResolved();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to resolve dispute";
      addNotification("error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Arbitrator Panel</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Buyer</span>
            <span className="font-mono">
              {buyerWallet.slice(0, 6)}...{buyerWallet.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Seller</span>
            <span className="font-mono">
              {sellerWallet.slice(0, 6)}...{sellerWallet.slice(-4)}
            </span>
          </div>
        </div>

        {evidence.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Evidence</h4>
            {evidence.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between bg-background p-2 rounded-lg text-sm"
              >
                <div>
                  <span className="text-muted">{e.evidence_type}</span>
                  <span className="ml-2">from {e.submitter_wallet.slice(0, 6)}...</span>
                </div>
                <a
                  href={`https://ipfs.io/ipfs/${e.ipfs_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            className="flex-1"
            loading={loading || isPending}
            onClick={() => handleResolve(false)}
          >
            Favor Seller
          </Button>
          <Button
            className="flex-1"
            loading={loading || isPending}
            onClick={() => handleResolve(true)}
          >
            Favor Buyer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
