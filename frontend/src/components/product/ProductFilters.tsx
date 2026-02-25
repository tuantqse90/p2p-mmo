"use client";

import { ProductCategory, ProductListParams } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface ProductFiltersProps {
  filters: ProductListParams;
  onChange: (filters: ProductListParams) => void;
}

const categoryOptions = [
  { value: "", label: "All Categories" },
  { value: ProductCategory.DATA, label: "Data" },
  { value: ProductCategory.ACCOUNTS, label: "Accounts" },
  { value: ProductCategory.TOOLS, label: "Tools" },
  { value: ProductCategory.SERVICES, label: "Services" },
  { value: ProductCategory.OTHER, label: "Other" },
];

const sortOptions = [
  { value: "created_at", label: "Newest" },
  { value: "price_usdt", label: "Price" },
  { value: "total_sold", label: "Best Selling" },
];

export function ProductFilters({ filters, onChange }: ProductFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Search products..."
          value={filters.search || ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
        />
      </div>

      <Select
        options={categoryOptions}
        value={filters.category || ""}
        onChange={(e) =>
          onChange({
            ...filters,
            category: (e.target.value as ProductCategory) || undefined,
            page: 1,
          })
        }
      />

      <Select
        options={sortOptions}
        value={filters.sort_by || "created_at"}
        onChange={(e) =>
          onChange({
            ...filters,
            sort_by: e.target.value as ProductListParams["sort_by"],
          })
        }
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          onChange({
            ...filters,
            sort_order: filters.sort_order === "asc" ? "desc" : "asc",
          })
        }
      >
        {filters.sort_order === "asc" ? "\u2191 Asc" : "\u2193 Desc"}
      </Button>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="Min $"
          className="w-24"
          value={filters.min_price ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              min_price: e.target.value ? Number(e.target.value) : undefined,
              page: 1,
            })
          }
        />
        <span className="text-muted">-</span>
        <Input
          type="number"
          placeholder="Max $"
          className="w-24"
          value={filters.max_price ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              max_price: e.target.value ? Number(e.target.value) : undefined,
              page: 1,
            })
          }
        />
      </div>
    </div>
  );
}
