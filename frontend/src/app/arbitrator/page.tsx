"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Notifications } from "@/components/layout/Notifications";
import { OrderCard } from "@/components/order/OrderCard";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Order, PaginatedResponse } from "@/lib/types";

interface ArbitratorInfo {
  is_registered: boolean;
  stake: number;
  reputation: number;
  active_disputes: number;
}

export default function ArbitratorPage() {
  const { isAuthenticated } = useAuth();
  const [info, setInfo] = useState<ArbitratorInfo | null>(null);
  const [disputes, setDisputes] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [arbInfo, arbOrders] = await Promise.all([
          api.get<ArbitratorInfo>("/arbitrator/me").catch(() => null),
          api
            .get<PaginatedResponse<Order>>("/orders?role=arbitrator")
            .catch(() => ({ items: [] })),
        ]);
        setInfo(arbInfo);
        setDisputes(arbOrders.items);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-lg">Sign in to access arbitrator panel</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Notifications />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Arbitrator Panel</h1>

        {/* Stats */}
        {info?.is_registered ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Stake</p>
                <p className="text-2xl font-bold text-primary">
                  {info.stake} USDT
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Reputation</p>
                <p className="text-2xl font-bold">{info.reputation}/100</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-sm text-muted">Active Disputes</p>
                <p className="text-2xl font-bold">{info.active_disputes}</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="mb-8">
            <CardContent className="text-center py-8">
              <p className="text-muted mb-4">
                You are not registered as an arbitrator.
                Stake at least 500 USDT to become one.
              </p>
              <Button>Register as Arbitrator</Button>
            </CardContent>
          </Card>
        )}

        {/* Assigned Disputes */}
        <h2 className="text-lg font-semibold mb-4">Assigned Disputes</h2>
        {disputes.length === 0 ? (
          <p className="text-muted text-center py-10">
            No disputes assigned to you
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {disputes.map((order) => (
              <OrderCard key={order.id} order={order} role="buyer" />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
