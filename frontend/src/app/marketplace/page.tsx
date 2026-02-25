"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Notifications } from "@/components/layout/Notifications";
import { ProductList } from "@/components/product/ProductList";
import { ProductFilters } from "@/components/product/ProductFilters";
import { api } from "@/lib/api";
import { Product, ProductListParams, PaginatedResponse } from "@/lib/types";

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<ProductListParams>({
    page: 1,
    page_size: 20,
    sort_by: "created_at",
    sort_order: "desc",
  });

  const fetchProducts = useCallback(async () => {
    const isInitial = products.length === 0;
    if (isInitial) setLoading(true);
    else setFiltering(true);
    try {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.page_size) params.set("page_size", String(filters.page_size));
      if (filters.category) params.set("category", filters.category);
      if (filters.min_price) params.set("min_price", String(filters.min_price));
      if (filters.max_price) params.set("max_price", String(filters.max_price));
      if (filters.search) params.set("search", filters.search);
      if (filters.sort_by) params.set("sort_by", filters.sort_by);
      if (filters.sort_order) params.set("sort_order", filters.sort_order);

      const data = await api.get<PaginatedResponse<Product>>(
        `/products?${params.toString()}`
      );
      setProducts(data.items);
      setTotalPages(data.total_pages);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setFiltering(false);
    }
  }, [filters, products.length]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Notifications />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Marketplace</h1>

        <div className="mb-6">
          <ProductFilters filters={filters} onChange={setFilters} />
        </div>

        {filtering && (
          <div className="flex items-center gap-2 mb-4 text-sm text-muted">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Updating results...
          </div>
        )}

        <ProductList
          products={products}
          loading={loading}
          totalPages={totalPages}
          currentPage={filters.page || 1}
          onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
        />
      </main>

      <Footer />
    </div>
  );
}
