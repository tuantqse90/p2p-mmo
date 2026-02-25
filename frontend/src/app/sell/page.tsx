"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Notifications } from "@/components/layout/Notifications";
import { ProductForm } from "@/components/product/ProductForm";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationStore } from "@/stores/notificationStore";
import { api } from "@/lib/api";
import { ProductCreate, Product, ApiResponse } from "@/lib/types";
import { useState } from "react";

export default function SellPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { addNotification } = useNotificationStore();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (product: ProductCreate) => {
    setLoading(true);
    try {
      await api.post<ApiResponse<Product>>("/products", product);
      addNotification("success", "Product listed successfully!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create listing";
      addNotification("error", message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-lg">
            Connect your wallet and sign in to create a listing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Notifications />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
        <ProductForm onSubmit={handleSubmit} loading={loading} />
      </main>

      <Footer />
    </div>
  );
}
