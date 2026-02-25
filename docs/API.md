# API Reference

Base URL: `https://api.example.com/api`

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

## Authentication

Wallet-based authentication using message signing. No email or password required.

### `POST /auth/nonce`

Request a signing nonce for wallet authentication.

**Request:**
```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nonce": "a1b2c3d4e5f6",
    "message": "P2P-Auth-1708123456-a1b2c3d4e5f6"
  }
}
```

### `POST /auth/verify`

Verify signed message and receive JWT.

**Request:**
```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "signature": "0x...",
  "public_key": "base64-encoded-nacl-public-key"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_at": "2024-02-25T12:00:00Z",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
  }
}
```

**Errors:**
| Code | Description |
|------|-------------|
| `INVALID_SIGNATURE` | Signature doesn't match wallet address |
| `NONCE_EXPIRED` | Nonce has expired (5 min TTL) |
| `NONCE_NOT_FOUND` | Nonce was not requested for this wallet |

---

## Products

### `GET /products`

List products (public, no auth required).

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page (max 100) |
| `category` | string | - | Filter by category |
| `min_price` | decimal | - | Minimum price in USDT |
| `max_price` | decimal | - | Maximum price in USDT |
| `sort` | string | `created_at` | Sort field: `created_at`, `price`, `rating` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |
| `search` | string | - | Search title and description |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "seller_wallet": "0x...",
        "seller_display_name": "CryptoTrader",
        "seller_rating": 4.8,
        "title_preview": "Premium Email List - 10K verified",
        "description_preview": "High-quality verified email list...",
        "category": "data",
        "price_usdt": "25.000000",
        "stock": 50,
        "total_sold": 120,
        "created_at": "2024-02-20T10:00:00Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

### `GET /products/:id`

Get product detail.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "seller_wallet": "0x...",
    "seller_display_name": "CryptoTrader",
    "seller_rating": 4.8,
    "seller_total_trades": 250,
    "title_preview": "Premium Email List - 10K verified",
    "description_preview": "High-quality verified email list for marketing...",
    "category": "data",
    "price_usdt": "25.000000",
    "stock": 50,
    "product_hash": "0xabc123...",
    "total_sold": 120,
    "reviews": [
      {
        "reviewer_wallet": "0x...",
        "rating": 5,
        "created_at": "2024-02-19T10:00:00Z"
      }
    ],
    "created_at": "2024-02-20T10:00:00Z"
  }
}
```

### `POST /products` (Auth Required)

Create a new product listing.

**Request:**
```json
{
  "title_preview": "Premium Email List - 10K verified",
  "description_preview": "High-quality verified email list for marketing campaigns",
  "category": "data",
  "price_usdt": "25.000000",
  "stock": 50,
  "product_hash": "0xabc123..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active",
    "created_at": "2024-02-20T10:00:00Z"
  }
}
```

**Validation:**
- `price_usdt` >= 1.0 (minimum order: 1 USDT)
- `stock` >= 1
- `title_preview` max 100 characters
- `category` must be one of: `data`, `accounts`, `tools`, `services`, `other`

### `PUT /products/:id` (Auth Required)

Update product listing. Only the seller can update.

**Request:** Same fields as POST (partial update supported).

### `DELETE /products/:id` (Auth Required)

Soft-delete (hide) product listing. Only the seller can delete.

---

## Orders

### `POST /orders` (Auth Required)

Create order record after on-chain transaction.

**Request:**
```json
{
  "product_id": "uuid",
  "chain": "bsc",
  "token": "USDT",
  "amount": "25.000000",
  "tx_hash_create": "0xdef456...",
  "onchain_order_id": 42
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "onchain_order_id": 42,
    "status": "created",
    "created_at": "2024-02-20T10:30:00Z"
  }
}
```

### `GET /orders` (Auth Required)

List user's orders (as buyer or seller).

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `role` | string | `all` | Filter: `buyer`, `seller`, `all` |
| `status` | string | - | Filter by status |
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Items per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "onchain_order_id": 42,
        "chain": "bsc",
        "product": {
          "id": "uuid",
          "title_preview": "Premium Email List"
        },
        "counterparty_wallet": "0x...",
        "counterparty_name": "CryptoTrader",
        "amount": "25.000000",
        "token": "USDT",
        "status": "seller_confirmed",
        "created_at": "2024-02-20T10:30:00Z",
        "updated_at": "2024-02-20T11:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

### `GET /orders/:id` (Auth Required)

Get order detail. Only buyer, seller, or assigned arbitrator can access.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "onchain_order_id": 42,
    "chain": "bsc",
    "buyer_wallet": "0x...",
    "seller_wallet": "0x...",
    "arbitrator_wallet": null,
    "product": {
      "id": "uuid",
      "title_preview": "Premium Email List",
      "product_hash": "0xabc123..."
    },
    "amount": "25.000000",
    "token": "USDT",
    "status": "seller_confirmed",
    "product_key_encrypted": "encrypted-base64-string",
    "tx_hash_create": "0xdef456...",
    "tx_hash_complete": null,
    "timeline": [
      { "event": "created", "at": "2024-02-20T10:30:00Z" },
      { "event": "seller_confirmed", "at": "2024-02-20T11:00:00Z" }
    ],
    "created_at": "2024-02-20T10:30:00Z",
    "updated_at": "2024-02-20T11:00:00Z"
  }
}
```

### `POST /orders/:id/deliver` (Auth Required — Seller Only)

Seller confirms delivery and sends encrypted product key.

**Request:**
```json
{
  "product_key_encrypted": "base64-encrypted-key-for-buyer",
  "tx_hash": "0x..."
}
```

### `POST /orders/:id/confirm` (Auth Required — Buyer Only)

Buyer confirms receipt after verifying the product.

**Request:**
```json
{
  "tx_hash": "0x...",
  "rating": 5
}
```

### `POST /orders/:id/cancel` (Auth Required — Buyer Only)

Cancel order. Only valid if seller hasn't confirmed delivery yet.

**Request:**
```json
{
  "tx_hash": "0x..."
}
```

**Errors:**
| Code | Description |
|------|-------------|
| `ORDER_NOT_CANCELLABLE` | Seller already confirmed delivery |
| `NOT_BUYER` | Only buyer can cancel |

### `POST /orders/:id/dispute` (Auth Required)

Open a dispute. Either buyer or seller can open.

**Request:**
```json
{
  "evidence_ipfs_hash": "QmXyz...",
  "reason": "Product not as described",
  "tx_hash": "0x..."
}
```

---

## Disputes

### `POST /disputes/:id/evidence` (Auth Required)

Submit additional evidence for an active dispute.

**Request:**
```json
{
  "ipfs_hash": "QmXyz...",
  "evidence_type": "screenshot"
}
```

**`evidence_type`**: `screenshot`, `conversation`, `product_proof`, `other`

### `POST /disputes/:id/resolve` (Auth Required — Arbitrator Only)

Resolve a dispute.

**Request:**
```json
{
  "favor_buyer": true,
  "reason_encrypted": "base64-encrypted-reason",
  "tx_hash": "0x..."
}
```

---

## Messages

End-to-end encrypted messages within an order context. The server only stores and relays ciphertext.

### `GET /orders/:id/messages` (Auth Required)

Get messages for an order. Only buyer, seller, or arbitrator can access.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `after` | timestamp | - | Messages after this timestamp |
| `limit` | int | 50 | Max messages to return |

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "sender_wallet": "0x...",
        "ciphertext": "base64-encrypted-content",
        "nonce": "base64-nonce",
        "created_at": "2024-02-20T11:05:00Z"
      }
    ]
  }
}
```

### `POST /orders/:id/messages` (Auth Required)

Send an encrypted message.

**Request:**
```json
{
  "ciphertext": "base64-encrypted-content",
  "nonce": "base64-nonce"
}
```

---

## WebSocket

### `WS /ws/orders/:id`

Real-time events for an order. Requires JWT in query param or header.

**Connection:**
```
ws://api.example.com/ws/orders/{order_id}?token={jwt}
```

**Events (server → client):**

```json
{
  "event": "status_changed",
  "data": {
    "order_id": "uuid",
    "old_status": "created",
    "new_status": "seller_confirmed",
    "timestamp": "2024-02-20T11:00:00Z"
  }
}
```

```json
{
  "event": "new_message",
  "data": {
    "message_id": "uuid",
    "sender_wallet": "0x...",
    "timestamp": "2024-02-20T11:05:00Z"
  }
}
```

```json
{
  "event": "dispute_opened",
  "data": {
    "order_id": "uuid",
    "opened_by": "0x...",
    "arbitrator_assigned": "0x...",
    "timestamp": "2024-02-20T12:00:00Z"
  }
}
```

```json
{
  "event": "dispute_resolved",
  "data": {
    "order_id": "uuid",
    "favor_buyer": true,
    "timestamp": "2024-02-20T13:00:00Z"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Not authorized for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests (100/min per wallet) |
| `INVALID_SIGNATURE` | 401 | Wallet signature verification failed |
| `NONCE_EXPIRED` | 401 | Auth nonce expired |
| `ORDER_NOT_CANCELLABLE` | 400 | Order cannot be cancelled in current state |
| `NOT_BUYER` | 403 | Action restricted to buyer |
| `NOT_SELLER` | 403 | Action restricted to seller |
| `NOT_ARBITRATOR` | 403 | Action restricted to assigned arbitrator |
| `DISPUTE_ALREADY_OPEN` | 400 | Order already has an active dispute |
| `ORDER_EXPIRED` | 400 | Order has expired |
| `CHAIN_MISMATCH` | 400 | Transaction on wrong chain |
| `TX_NOT_CONFIRMED` | 400 | Transaction not yet confirmed on-chain |
| `SELLER_LIMIT_EXCEEDED` | 400 | New seller daily/amount limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Rate Limiting

- **Global**: 100 requests per minute per wallet address
- **Auth endpoints**: 10 requests per minute per IP
- **WebSocket**: 1 connection per order per wallet

Rate limit headers included in every response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708123516
```
