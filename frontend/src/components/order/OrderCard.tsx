"use client";

import Link from "next/link";
import { Order, TokenType } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { OrderStatusBadge } from "@/components/ui/Badge";

interface OrderCardProps {
  order: Order;
  role: "buyer" | "seller";
}

export function OrderCard({ order, role }: OrderCardProps) {
  const counterparty =
    role === "buyer" ? order.seller_wallet : order.buyer_wallet;

  return (
    <Link href={`/orders/${order.id}`}>
      <Card hover>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted uppercase font-medium">
              {role === "buyer" ? "Purchase" : "Sale"}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Amount</span>
              <span className="text-sm font-semibold">
                {order.amount} {order.token}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">
                {role === "buyer" ? "Seller" : "Buyer"}
              </span>
              <span className="text-sm font-mono">
                {counterparty.slice(0, 6)}...{counterparty.slice(-4)}
              </span>
            </div>
            {order.onchain_order_id !== null && (
              <div className="flex justify-between">
                <span className="text-sm text-muted">On-chain ID</span>
                <span className="text-sm">#{order.onchain_order_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted">Created</span>
              <span className="text-sm">
                {new Date(order.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
