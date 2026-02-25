export enum ProductCategory {
  DATA = "data",
  ACCOUNTS = "accounts",
  TOOLS = "tools",
  SERVICES = "services",
  OTHER = "other",
}

export enum ProductStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  SOLD_OUT = "sold_out",
  DELETED = "deleted",
}

export enum TokenType {
  USDT = "USDT",
  USDC = "USDC",
}

export enum OrderStatus {
  CREATED = "created",
  SELLER_CONFIRMED = "seller_confirmed",
  COMPLETED = "completed",
  DISPUTED = "disputed",
  RESOLVED_BUYER = "resolved_buyer",
  RESOLVED_SELLER = "resolved_seller",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

export enum EvidenceType {
  SCREENSHOT = "screenshot",
  CONVERSATION = "conversation",
  PRODUCT_PROOF = "product_proof",
  OTHER = "other",
}

export interface Product {
  id: string;
  seller_wallet: string;
  title_preview: string;
  description_preview: string | null;
  category: ProductCategory;
  price_usdt: number;
  stock: number;
  total_sold: number;
  product_hash: string;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  title_preview: string;
  description_preview?: string;
  category: ProductCategory;
  price_usdt: number;
  stock: number;
  product_hash: string;
}

export interface ProductListParams {
  page?: number;
  page_size?: number;
  category?: ProductCategory;
  min_price?: number;
  max_price?: number;
  search?: string;
  sort_by?: "created_at" | "price_usdt" | "total_sold";
  sort_order?: "asc" | "desc";
}

export interface Order {
  id: string;
  onchain_order_id: number | null;
  chain: string;
  buyer_wallet: string;
  seller_wallet: string;
  arbitrator_wallet: string | null;
  product_id: string;
  token: TokenType;
  amount: number;
  platform_fee: number;
  status: OrderStatus;
  product_key_encrypted: string | null;
  tx_hash_create: string;
  tx_hash_complete: string | null;
  seller_confirmed_at: string | null;
  dispute_opened_at: string | null;
  dispute_deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderCreate {
  product_id: string;
  token: TokenType;
  amount: number;
  tx_hash: string;
  chain?: string;
}

export interface Message {
  id: string;
  order_id: string;
  sender_wallet: string;
  ciphertext: string;
  nonce: string;
  created_at: string;
}

export interface Evidence {
  id: string;
  order_id: string;
  submitter_wallet: string;
  ipfs_hash: string;
  evidence_type: EvidenceType;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
