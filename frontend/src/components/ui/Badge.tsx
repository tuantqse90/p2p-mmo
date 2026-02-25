import { OrderStatus, ProductStatus } from "@/lib/types";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "muted";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-blue-500/15 text-blue-400",
  muted: "bg-muted/15 text-muted",
};

export function Badge({ variant = "muted", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

const orderStatusVariant: Record<OrderStatus, BadgeVariant> = {
  [OrderStatus.CREATED]: "info",
  [OrderStatus.SELLER_CONFIRMED]: "warning",
  [OrderStatus.COMPLETED]: "success",
  [OrderStatus.DISPUTED]: "danger",
  [OrderStatus.RESOLVED_BUYER]: "success",
  [OrderStatus.RESOLVED_SELLER]: "success",
  [OrderStatus.CANCELLED]: "muted",
  [OrderStatus.EXPIRED]: "muted",
};

const orderStatusLabel: Record<OrderStatus, string> = {
  [OrderStatus.CREATED]: "Created",
  [OrderStatus.SELLER_CONFIRMED]: "Seller Confirmed",
  [OrderStatus.COMPLETED]: "Completed",
  [OrderStatus.DISPUTED]: "Disputed",
  [OrderStatus.RESOLVED_BUYER]: "Resolved (Buyer)",
  [OrderStatus.RESOLVED_SELLER]: "Resolved (Seller)",
  [OrderStatus.CANCELLED]: "Cancelled",
  [OrderStatus.EXPIRED]: "Expired",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant={orderStatusVariant[status]}>
      {orderStatusLabel[status]}
    </Badge>
  );
}

const productStatusVariant: Record<ProductStatus, BadgeVariant> = {
  [ProductStatus.ACTIVE]: "success",
  [ProductStatus.PAUSED]: "warning",
  [ProductStatus.SOLD_OUT]: "muted",
  [ProductStatus.DELETED]: "danger",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge variant={productStatusVariant[status]}>
      {status.replace("_", " ")}
    </Badge>
  );
}
