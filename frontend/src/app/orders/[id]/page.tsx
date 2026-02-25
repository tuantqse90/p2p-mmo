"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Notifications } from "@/components/layout/Notifications";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { DisputeForm } from "@/components/dispute/DisputeForm";
import { ResolvePanel } from "@/components/dispute/ResolvePanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { useEscrowContract } from "@/hooks/useEscrowContract";
import { useNotificationStore } from "@/stores/notificationStore";
import { api } from "@/lib/api";
import { Order, OrderStatus, Evidence } from "@/lib/types";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, walletAddress } = useAuth();
  const {
    sellerConfirmDelivery,
    buyerConfirmReceived,
    cancelOrder,
    isPending,
  } = useEscrowContract();
  const { addNotification } = useNotificationStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const data = await api.get<Order>(`/orders/${id}`);
      setOrder(data);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Fetch evidence if disputed
  useEffect(() => {
    if (
      order &&
      [
        OrderStatus.DISPUTED,
        OrderStatus.RESOLVED_BUYER,
        OrderStatus.RESOLVED_SELLER,
      ].includes(order.status)
    ) {
      api
        .get<{ items: Evidence[] }>(`/orders/${id}/evidence`)
        .then((data) => setEvidence(data.items))
        .catch(() => {});
    }
  }, [order, id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!order || !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-lg">Order not found or not signed in</p>
        </div>
      </div>
    );
  }

  const isBuyer =
    walletAddress?.toLowerCase() === order.buyer_wallet.toLowerCase();
  const isSeller =
    walletAddress?.toLowerCase() === order.seller_wallet.toLowerCase();
  const isArbitrator =
    walletAddress?.toLowerCase() === order.arbitrator_wallet?.toLowerCase();

  const handleSellerConfirm = async () => {
    if (!order.onchain_order_id) return;
    setActionLoading(true);
    try {
      await sellerConfirmDelivery(BigInt(order.onchain_order_id));
      await api.post(`/orders/${id}/deliver`, {
        product_key_encrypted: "delivered",
      });
      addNotification("success", "Delivery confirmed");
      fetchOrder();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Action failed";
      addNotification("error", message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuyerConfirm = async () => {
    if (!order.onchain_order_id) return;
    setActionLoading(true);
    try {
      await buyerConfirmReceived(BigInt(order.onchain_order_id));
      await api.post(`/orders/${id}/confirm`, { rating: 5 });
      addNotification("success", "Order completed!");
      fetchOrder();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Action failed";
      addNotification("error", message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!order.onchain_order_id) return;
    setActionLoading(true);
    try {
      await cancelOrder(BigInt(order.onchain_order_id));
      await api.post(`/orders/${id}/cancel`);
      addNotification("info", "Order cancelled");
      fetchOrder();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Cancel failed";
      addNotification("error", message);
    } finally {
      setActionLoading(false);
    }
  };

  // Determine counterparty public key for chat
  // In a real implementation, this would be fetched from the user profile
  const counterpartyPublicKey = null; // TODO: fetch from user profile API

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Notifications />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h1 className="text-lg font-bold">Order Details</h1>
                  <OrderStatusBadge status={order.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <OrderTimeline status={order.status} />

                <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <span className="text-muted">Amount</span>
                    <p className="font-semibold">
                      {order.amount} {order.token}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Platform Fee</span>
                    <p>{order.platform_fee} {order.token}</p>
                  </div>
                  <div>
                    <span className="text-muted">Buyer</span>
                    <p className="font-mono text-xs">
                      {order.buyer_wallet.slice(0, 10)}...
                      {order.buyer_wallet.slice(-6)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Seller</span>
                    <p className="font-mono text-xs">
                      {order.seller_wallet.slice(0, 10)}...
                      {order.seller_wallet.slice(-6)}
                    </p>
                  </div>
                  {order.onchain_order_id !== null && (
                    <div>
                      <span className="text-muted">On-chain ID</span>
                      <p>#{order.onchain_order_id}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted">Created</span>
                    <p>{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                  {isSeller &&
                    order.status === OrderStatus.CREATED && (
                      <Button
                        loading={actionLoading || isPending}
                        onClick={handleSellerConfirm}
                      >
                        Confirm Delivery
                      </Button>
                    )}

                  {isBuyer &&
                    order.status === OrderStatus.SELLER_CONFIRMED && (
                      <>
                        <Button
                          loading={actionLoading || isPending}
                          onClick={handleBuyerConfirm}
                        >
                          Confirm Received
                        </Button>
                        <Button
                          variant="danger"
                          loading={actionLoading || isPending}
                          onClick={() => setDisputeOpen(true)}
                        >
                          Open Dispute
                        </Button>
                      </>
                    )}

                  {isBuyer &&
                    order.status === OrderStatus.CREATED && (
                      <Button
                        variant="secondary"
                        loading={actionLoading || isPending}
                        onClick={handleCancel}
                      >
                        Cancel Order
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <ChatWindow
              orderId={order.id}
              counterpartyPublicKey={counterpartyPublicKey}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Arbitrator Panel */}
            {isArbitrator &&
              order.status === OrderStatus.DISPUTED &&
              order.onchain_order_id !== null && (
                <ResolvePanel
                  orderId={order.id}
                  onchainOrderId={order.onchain_order_id}
                  buyerWallet={order.buyer_wallet}
                  sellerWallet={order.seller_wallet}
                  evidence={evidence}
                  onResolved={fetchOrder}
                />
              )}

            {/* TX Links */}
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Transactions</h3>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {order.tx_hash_create && (
                  <a
                    href={`https://bscscan.com/tx/${order.tx_hash_create}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline block truncate"
                  >
                    Creation TX
                  </a>
                )}
                {order.tx_hash_complete && (
                  <a
                    href={`https://bscscan.com/tx/${order.tx_hash_complete}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline block truncate"
                  >
                    Completion TX
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />

      {order.onchain_order_id !== null && (
        <DisputeForm
          orderId={order.id}
          onchainOrderId={order.onchain_order_id}
          open={disputeOpen}
          onClose={() => setDisputeOpen(false)}
          onSuccess={fetchOrder}
        />
      )}
    </div>
  );
}
