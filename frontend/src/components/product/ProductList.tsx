"use client";

import { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { Spinner } from "@/components/ui/Spinner";

interface ProductListProps {
  products: Product[];
  loading?: boolean;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function ProductList({
  products,
  loading,
  totalPages = 1,
  currentPage = 1,
  onPageChange,
}: ProductListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted text-lg">No products found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {totalPages > 1 && onPageChange && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-muted px-4">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 text-sm rounded-lg border border-border text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
