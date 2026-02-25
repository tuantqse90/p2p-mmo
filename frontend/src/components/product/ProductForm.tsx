"use client";

import { useState } from "react";
import { ProductCategory, ProductCreate } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { keccak256, toBytes } from "viem";

const categoryOptions = [
  { value: ProductCategory.DATA, label: "Data" },
  { value: ProductCategory.ACCOUNTS, label: "Accounts" },
  { value: ProductCategory.TOOLS, label: "Tools" },
  { value: ProductCategory.SERVICES, label: "Services" },
  { value: ProductCategory.OTHER, label: "Other" },
];

interface ProductFormProps {
  onSubmit: (product: ProductCreate) => Promise<void>;
  loading?: boolean;
}

export function ProductForm({ onSubmit, loading }: ProductFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProductCategory>(
    ProductCategory.OTHER
  );
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!price || Number(price) <= 0)
      newErrors.price = "Price must be greater than 0";
    if (!stock || Number(stock) < 0) newErrors.stock = "Invalid stock";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const productHash = keccak256(
      toBytes(`${title}:${description}:${Date.now()}`)
    );

    await onSubmit({
      title_preview: title,
      description_preview: description || undefined,
      category,
      price_usdt: Number(price),
      stock: Number(stock),
      product_hash: productHash,
    });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Create New Listing</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Product title (visible to buyers)"
            maxLength={100}
            error={errors.title}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description (visible to buyers)"
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
            />
          </div>

          <Select
            label="Category"
            options={categoryOptions}
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Price (USDT)"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              error={errors.price}
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              error={errors.stock}
            />
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Create Listing
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
