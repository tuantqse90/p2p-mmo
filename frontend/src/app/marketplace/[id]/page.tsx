"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Notifications } from "@/components/layout/Notifications";
import { BuyFlow } from "@/components/order/BuyFlow";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ProductStatusBadge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Product, ProductCategory, ProductStatus } from "@/lib/types";

const categoryLabel: Record<ProductCategory, string> = {
  [ProductCategory.DATA]: "Data",
  [ProductCategory.ACCOUNTS]: "Accounts",
  [ProductCategory.TOOLS]: "Tools",
  [ProductCategory.SERVICES]: "Services",
  [ProductCategory.OTHER]: "Other",
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, walletAddress } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyOpen, setBuyOpen] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await api.get<Product>(`/products/${id}`);
        setProduct(data);
      } catch {
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

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

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-lg">Product not found</p>
        </div>
      </div>
    );
  }

  const isSeller =
    walletAddress?.toLowerCase() === product.seller_wallet.toLowerCase();
  const canBuy =
    isAuthenticated &&
    !isSeller &&
    product.status === ProductStatus.ACTIVE &&
    product.stock > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <Notifications />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted hover:text-foreground mb-4 inline-block"
        >
          &larr; Back
        </button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{product.title_preview}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="info">{categoryLabel[product.category]}</Badge>
                  <ProductStatusBadge status={product.status} />
                </div>
              </div>
              <span className="text-2xl font-bold text-primary">
                ${product.price_usdt}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {product.description_preview && (
              <p className="text-muted">{product.description_preview}</p>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted">Seller</span>
                <p className="font-mono">
                  {product.seller_wallet.slice(0, 6)}...
                  {product.seller_wallet.slice(-4)}
                </p>
              </div>
              <div>
                <span className="text-muted">Stock</span>
                <p>{product.stock}</p>
              </div>
              <div>
                <span className="text-muted">Total Sold</span>
                <p>{product.total_sold}</p>
              </div>
              <div>
                <span className="text-muted">Listed</span>
                <p>{new Date(product.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {canBuy && (
              <Button className="w-full" onClick={() => setBuyOpen(true)}>
                Buy Now
              </Button>
            )}

            {isSeller && (
              <p className="text-sm text-muted text-center">
                This is your listing
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />

      {product && (
        <BuyFlow
          product={product}
          open={buyOpen}
          onClose={() => setBuyOpen(false)}
          onSuccess={() => {
            setBuyOpen(false);
            router.push("/dashboard");
          }}
        />
      )}
    </div>
  );
}
