/**
 * Shared mock data for Playwright E2E tests.
 * Types match the interfaces defined in src/lib/types.ts.
 */

// ---- Enums (duplicated to avoid importing from src in test code) ----

export const ProductCategory = {
  DATA: "data",
  ACCOUNTS: "accounts",
  TOOLS: "tools",
  SERVICES: "services",
  OTHER: "other",
} as const;

export const ProductStatus = {
  ACTIVE: "active",
  PAUSED: "paused",
  SOLD_OUT: "sold_out",
  DELETED: "deleted",
} as const;

export const TokenType = {
  USDT: "USDT",
  USDC: "USDC",
} as const;

export const OrderStatus = {
  CREATED: "created",
  SELLER_CONFIRMED: "seller_confirmed",
  COMPLETED: "completed",
  DISPUTED: "disputed",
  RESOLVED_BUYER: "resolved_buyer",
  RESOLVED_SELLER: "resolved_seller",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;

export const EvidenceType = {
  SCREENSHOT: "screenshot",
  CONVERSATION: "conversation",
  PRODUCT_PROOF: "product_proof",
  OTHER: "other",
} as const;

// ---- Wallets ----

export const TEST_BUYER = "0x1234567890123456789012345678901234567890";
export const TEST_SELLER = "0x0987654321098765432109876543210987654321";
export const TEST_ARBITRATOR = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

// ---- Products ----

export const mockProducts = [
  {
    id: "prod-001",
    seller_wallet: TEST_SELLER,
    title_preview: "Premium Data Bundle",
    description_preview: "High-quality dataset for ML training",
    category: ProductCategory.DATA,
    price_usdt: 99.99,
    stock: 50,
    total_sold: 25,
    product_hash: "0x" + "f".repeat(64),
    status: ProductStatus.ACTIVE,
    created_at: "2026-02-20T12:00:00Z",
    updated_at: "2026-02-24T12:00:00Z",
  },
  {
    id: "prod-002",
    seller_wallet: TEST_SELLER,
    title_preview: "API Access Tool",
    description_preview: "Professional API integration toolkit",
    category: ProductCategory.TOOLS,
    price_usdt: 49.5,
    stock: 100,
    total_sold: 12,
    product_hash: "0x" + "a".repeat(64),
    status: ProductStatus.ACTIVE,
    created_at: "2026-02-18T08:00:00Z",
    updated_at: "2026-02-23T08:00:00Z",
  },
  {
    id: "prod-003",
    seller_wallet: TEST_SELLER,
    title_preview: "Premium Service Package",
    description_preview: null,
    category: ProductCategory.SERVICES,
    price_usdt: 199.0,
    stock: 5,
    total_sold: 3,
    product_hash: "0x" + "b".repeat(64),
    status: ProductStatus.ACTIVE,
    created_at: "2026-02-15T10:00:00Z",
    updated_at: "2026-02-22T10:00:00Z",
  },
];

export function paginatedProducts(items = mockProducts) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    total_pages: 1,
  };
}

// ---- Orders ----

export const mockOrders = [
  {
    id: "order-001",
    onchain_order_id: 1,
    chain: "bsc",
    buyer_wallet: TEST_BUYER,
    seller_wallet: TEST_SELLER,
    arbitrator_wallet: null,
    product_id: "prod-001",
    token: TokenType.USDT,
    amount: 99.99,
    platform_fee: 2.0,
    status: OrderStatus.CREATED,
    product_key_encrypted: null,
    tx_hash_create: "0x" + "c".repeat(64),
    tx_hash_complete: null,
    seller_confirmed_at: null,
    dispute_opened_at: null,
    dispute_deadline: null,
    completed_at: null,
    created_at: "2026-02-24T14:00:00Z",
    updated_at: "2026-02-24T14:00:00Z",
  },
  {
    id: "order-002",
    onchain_order_id: 2,
    chain: "bsc",
    buyer_wallet: TEST_BUYER,
    seller_wallet: TEST_SELLER,
    arbitrator_wallet: null,
    product_id: "prod-002",
    token: TokenType.USDT,
    amount: 49.5,
    platform_fee: 1.0,
    status: OrderStatus.SELLER_CONFIRMED,
    product_key_encrypted: "enc-key-data",
    tx_hash_create: "0x" + "d".repeat(64),
    tx_hash_complete: null,
    seller_confirmed_at: "2026-02-24T15:00:00Z",
    dispute_opened_at: null,
    dispute_deadline: null,
    completed_at: null,
    created_at: "2026-02-23T10:00:00Z",
    updated_at: "2026-02-24T15:00:00Z",
  },
  {
    id: "order-003",
    onchain_order_id: 3,
    chain: "bsc",
    buyer_wallet: TEST_BUYER,
    seller_wallet: TEST_SELLER,
    arbitrator_wallet: null,
    product_id: "prod-001",
    token: TokenType.USDC,
    amount: 99.99,
    platform_fee: 2.0,
    status: OrderStatus.COMPLETED,
    product_key_encrypted: "enc-key-data",
    tx_hash_create: "0x" + "e".repeat(64),
    tx_hash_complete: "0x" + "f".repeat(64),
    seller_confirmed_at: "2026-02-22T10:00:00Z",
    dispute_opened_at: null,
    dispute_deadline: null,
    completed_at: "2026-02-22T12:00:00Z",
    created_at: "2026-02-21T09:00:00Z",
    updated_at: "2026-02-22T12:00:00Z",
  },
  {
    id: "order-004",
    onchain_order_id: 4,
    chain: "bsc",
    buyer_wallet: TEST_BUYER,
    seller_wallet: TEST_SELLER,
    arbitrator_wallet: TEST_ARBITRATOR,
    product_id: "prod-003",
    token: TokenType.USDT,
    amount: 199.0,
    platform_fee: 4.0,
    status: OrderStatus.DISPUTED,
    product_key_encrypted: "enc-key-data",
    tx_hash_create: "0x" + "1".repeat(64),
    tx_hash_complete: null,
    seller_confirmed_at: "2026-02-20T10:00:00Z",
    dispute_opened_at: "2026-02-21T10:00:00Z",
    dispute_deadline: "2026-02-28T10:00:00Z",
    completed_at: null,
    created_at: "2026-02-19T09:00:00Z",
    updated_at: "2026-02-21T10:00:00Z",
  },
];

export function paginatedOrders(items = mockOrders) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    total_pages: 1,
  };
}

// ---- Messages ----

export const mockMessages = [
  {
    id: "msg-001",
    order_id: "order-001",
    sender_wallet: TEST_SELLER,
    ciphertext: "ZW5jcnlwdGVkLW1lc3NhZ2UtMQ==",
    nonce: "bm9uY2UtMQ==",
    created_at: "2026-02-24T14:05:00Z",
  },
  {
    id: "msg-002",
    order_id: "order-001",
    sender_wallet: TEST_BUYER,
    ciphertext: "ZW5jcnlwdGVkLW1lc3NhZ2UtMg==",
    nonce: "bm9uY2UtMg==",
    created_at: "2026-02-24T14:06:00Z",
  },
];

// ---- Evidence ----

export const mockEvidence = [
  {
    id: "evidence-001",
    order_id: "order-004",
    submitter_wallet: TEST_BUYER,
    ipfs_hash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    evidence_type: EvidenceType.SCREENSHOT,
    created_at: "2026-02-21T10:05:00Z",
  },
];
