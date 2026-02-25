"use client";

import { memo } from "react";
import Link from "next/link";
import { Product, ProductCategory } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, ProductStatusBadge } from "@/components/ui/Badge";

const categoryLabel: Record<ProductCategory, string> = {
  [ProductCategory.DATA]: "Data",
  [ProductCategory.ACCOUNTS]: "Accounts",
  [ProductCategory.TOOLS]: "Tools",
  [ProductCategory.SERVICES]: "Services",
  [ProductCategory.OTHER]: "Other",
};

interface ProductCardProps {
  product: Product;
}

export const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  return (
    <Link href={`/marketplace/${product.id}`}>
      <Card hover>
        <CardContent>
          <div className="flex items-start justify-between mb-3">
            <Badge variant="info">{categoryLabel[product.category]}</Badge>
            <ProductStatusBadge status={product.status} />
          </div>

          <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
            {product.title_preview}
          </h3>
          {product.description_preview && (
            <p className="text-sm text-muted line-clamp-2 mb-3">
              {product.description_preview}
            </p>
          )}

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
            <span className="text-lg font-bold text-primary">
              ${product.price_usdt}
            </span>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>Stock: {product.stock}</span>
              <span>Sold: {product.total_sold}</span>
            </div>
          </div>

          <p className="text-xs text-muted mt-2 truncate">
            Seller: {product.seller_wallet.slice(0, 6)}...
            {product.seller_wallet.slice(-4)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
});
