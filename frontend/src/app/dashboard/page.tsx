"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Notifications } from "@/components/layout/Notifications";
import { OrderCard } from "@/components/order/OrderCard";
import { ProductCard } from "@/components/product/ProductCard";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Order, Product, PaginatedResponse } from "@/lib/types";

type Tab = "purchases" | "sales" | "listings";

export default function DashboardPage() {
  const { isAuthenticated, walletAddress } = useAuth();
  const [tab, setTab] = useState<Tab>("purchases");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (tab === "purchases") {
          const data = await api.get<PaginatedResponse<Order>>(
            `/orders?role=buyer&page=${page}&page_size=${pageSize}`
          );
          setOrders(data.items);
          setTotalPages(data.total_pages);
        } else if (tab === "sales") {
          const data = await api.get<PaginatedResponse<Order>>(
            `/orders?role=seller&page=${page}&page_size=${pageSize}`
          );
          setOrders(data.items);
          setTotalPages(data.total_pages);
        } else {
          const data = await api.get<PaginatedResponse<Product>>(
            `/products/me?page=${page}&page_size=${pageSize}`
          );
          setProducts(data.items);
          setTotalPages(data.total_pages);
        }
      } catch {
        setOrders([]);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tab, page, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-lg">
            Connect your wallet and sign in to view your dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Notifications />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(["purchases", "sales", "listings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : tab === "listings" ? (
          products.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <p>No listings yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <p>No {tab} yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                role={tab === "purchases" ? "buyer" : "seller"}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
