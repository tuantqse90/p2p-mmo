# Database Documentation

PostgreSQL schema, migrations, indexing, and maintenance guide for P2P Escrow Privacy Marketplace.

## Table of Contents

- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Enums](#enums)
- [Tables](#tables)
  - [user_profiles](#user_profiles)
  - [products](#products)
  - [orders](#orders)
  - [messages](#messages)
  - [reviews](#reviews)
  - [arbitrators](#arbitrators)
  - [dispute_evidence](#dispute_evidence)
  - [blacklist](#blacklist)
  - [event_sync_cursor](#event_sync_cursor)
- [Indexes](#indexes)
- [Constraints & Business Rules](#constraints--business-rules)
- [Migrations (Alembic)](#migrations-alembic)
- [Connection Management](#connection-management)
- [Read Replicas](#read-replicas)
- [Common Queries](#common-queries)
- [Performance Optimization](#performance-optimization)
- [Maintenance](#maintenance)
- [Backup & Recovery](#backup--recovery)

---

## Overview

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 15+ |
| ORM | SQLAlchemy 2.x (async, via `asyncpg`) |
| Migrations | Alembic |
| Extensions | `uuid-ossp`, `pg_trgm` |
| Connection pool | asyncpg pool (default 20, max overflow 10) |
| Encoding | UTF-8 |

**Design principles:**

- Wallet address as natural key for user-related tables (no auto-increment user ID)
- UUIDs for all entity primary keys (except user_profiles)
- All timestamps in UTC (`TIMESTAMPTZ`)
- Soft deletes where applicable (`deleted_at` column)
- No plaintext sensitive data stored — only ciphertext, nonces, and public keys
- `chain` field on orders for multi-chain support

---

## Entity Relationship Diagram

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  user_profiles   │         │    products       │         │   arbitrators    │
│──────────────────│         │──────────────────│         │──────────────────│
│ wallet (PK)      │◄──────┐ │ id (PK, UUID)    │    ┌──>│ wallet (PK)      │
│ display_name     │       │ │ seller_wallet(FK) │────┘   │ stake_amount     │
│ public_key       │       │ │ title_preview     │        │ stake_token      │
│ reputation_score │       │ │ description_prev  │        │ reputation       │
│ total_trades     │       │ │ category          │        │ total_resolved   │
│ total_as_buyer   │       │ │ price_usdt        │        │ total_earned     │
│ total_as_seller  │       │ │ stock             │        │ is_active        │
│ rating           │       │ │ total_sold        │        │ registered_at    │
│ tier             │       │ │ product_hash      │        └──────────────────┘
│ is_blacklisted   │       │ │ status            │
│ created_at       │       │ │ created_at        │
│ updated_at       │       │ │ updated_at        │
└──────────────────┘       │ │ deleted_at        │
        ▲                  │ └────────┬─────────┘
        │                  │          │
        │                  │   ┌──────▼──────────────┐     ┌──────────────────────┐
        │                  │   │      orders          │     │  dispute_evidence    │
        │                  │   │─────────────────────│     │──────────────────────│
        │                  ├───│ id (PK, UUID)       │     │ id (PK, UUID)        │
        │                  ├───│ buyer_wallet (FK)   │     │ order_id (FK)        │──┐
        │                  │   │ seller_wallet (FK)  │◄────│ submitter_wallet(FK) │  │
        │                  │   │ arbitrator_wallet   │     │ ipfs_hash            │  │
        │                  │   │ product_id (FK)     │     │ evidence_type        │  │
        │                  │   │ chain               │     │ created_at           │  │
        │                  │   │ token               │     └──────────────────────┘  │
        │                  │   │ amount              │                               │
        │                  │   │ platform_fee        │                               │
        │                  │   │ status              │◄──────────────────────────────┘
        │                  │   │ onchain_order_id    │
        │                  │   │ tx_hash_create      │
        │                  │   │ tx_hash_complete    │
        │                  │   │ product_key_encrypt │
        │                  │   │ created_at          │
        │                  │   │ updated_at          │
        │                  │   └───────┬──────┬──────┘
        │                  │           │      │
        │                  │    ┌──────▼───┐  │  ┌──────────────────┐
        │                  │    │ messages  │  │  │    reviews       │
        │                  │    │──────────│  │  │──────────────────│
        │                  └────│ id (UUID)│  └─>│ id (PK, UUID)    │
        │                       │ order_id │     │ order_id (FK)    │
        └───────────────────────│ sender   │     │ reviewer_wallet  │
                                │ ciphertxt│     │ target_wallet    │
                                │ nonce    │     │ rating           │
                                │ created  │     │ created_at       │
                                └──────────┘     └──────────────────┘
```

---

## Enums

```sql
-- Order status (mirrors smart contract OrderStatus)
CREATE TYPE order_status AS ENUM (
    'created',              -- Buyer locked funds on-chain
    'seller_confirmed',     -- Seller confirmed delivery
    'completed',            -- Buyer confirmed receipt, funds released
    'disputed',             -- Dispute opened, awaiting arbitrator
    'resolved_buyer',       -- Arbitrator ruled for buyer
    'resolved_seller',      -- Arbitrator ruled for seller
    'cancelled',            -- Buyer cancelled before seller confirmed
    'expired'               -- Auto-expired due to timeout
);

-- Product status
CREATE TYPE product_status AS ENUM (
    'active',               -- Listed and available
    'paused',               -- Seller paused listing
    'sold_out',             -- Stock depleted
    'deleted'               -- Soft-deleted by seller
);

-- Product category
CREATE TYPE product_category AS ENUM (
    'data',
    'accounts',
    'tools',
    'services',
    'other'
);

-- User reputation tier
CREATE TYPE user_tier AS ENUM (
    'new',                  -- 0-9 trades
    'standard',             -- 10-99 trades
    'trusted'               -- 100+ trades, rating >= 4.0
);

-- Evidence type
CREATE TYPE evidence_type AS ENUM (
    'screenshot',
    'conversation',
    'product_proof',
    'other'
);

-- Supported blockchain chains
CREATE TYPE chain_type AS ENUM (
    'bsc',
    'ethereum',
    'arbitrum',
    'base'
);

-- Payment token symbol
CREATE TYPE token_type AS ENUM (
    'USDT',
    'USDC'
);
```

---

## Tables

### user_profiles

Stores wallet-based user identities. Created on first authentication.

```sql
CREATE TABLE user_profiles (
    wallet          VARCHAR(42)     PRIMARY KEY,        -- EIP-55 checksum address
    display_name    VARCHAR(50),                        -- Optional display name
    public_key      VARCHAR(88)     NOT NULL,           -- Base64-encoded NaCl public key (32 bytes)
    reputation_score DECIMAL(6,2)   NOT NULL DEFAULT 0, -- Cumulative reputation score
    total_trades    INTEGER         NOT NULL DEFAULT 0, -- Completed trades (buy + sell)
    total_as_buyer  INTEGER         NOT NULL DEFAULT 0,
    total_as_seller INTEGER         NOT NULL DEFAULT 0,
    rating          DECIMAL(3,2)    DEFAULT NULL,       -- Average review rating (1.00-5.00)
    tier            user_tier       NOT NULL DEFAULT 'new',
    is_blacklisted  BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Wallet-based user identities. No PII stored.';
COMMENT ON COLUMN user_profiles.wallet IS 'EIP-55 checksum Ethereum address, e.g. 0x742d35Cc...';
COMMENT ON COLUMN user_profiles.public_key IS 'NaCl public key for E2E encryption, base64-encoded';
COMMENT ON COLUMN user_profiles.reputation_score IS 'Calculated: +1 trade, +0.5 5-star, -3 dispute lost, +1 dispute won, -2 seller cancel';
```

### products

Marketplace product listings. The server stores only preview text — full product data is encrypted off-chain.

```sql
CREATE TABLE products (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_wallet       VARCHAR(42)     NOT NULL REFERENCES user_profiles(wallet),
    title_preview       VARCHAR(100)    NOT NULL,
    description_preview VARCHAR(500)    NOT NULL,
    category            product_category NOT NULL,
    price_usdt          DECIMAL(18,6)   NOT NULL,       -- Price in USDT (6 decimal places)
    stock               INTEGER         NOT NULL DEFAULT 1,
    total_sold          INTEGER         NOT NULL DEFAULT 0,
    product_hash        VARCHAR(66)     NOT NULL,       -- SHA-256 hash (0x + 64 hex chars)
    status              product_status  NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,                    -- Soft delete

    CONSTRAINT chk_price_min CHECK (price_usdt >= 1.0),
    CONSTRAINT chk_stock_positive CHECK (stock >= 0),
    CONSTRAINT chk_total_sold_positive CHECK (total_sold >= 0)
);

COMMENT ON TABLE products IS 'Marketplace listings. Only public previews stored — full data encrypted off-chain.';
COMMENT ON COLUMN products.product_hash IS 'SHA-256 hash of actual product data for integrity verification on-chain';
```

### orders

Core transaction table. Each row maps to an on-chain escrow order. The backend syncs state from blockchain events.

```sql
CREATE TABLE orders (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    onchain_order_id        BIGINT          NOT NULL,       -- Smart contract order ID
    chain                   chain_type      NOT NULL,
    buyer_wallet            VARCHAR(42)     NOT NULL REFERENCES user_profiles(wallet),
    seller_wallet           VARCHAR(42)     NOT NULL REFERENCES user_profiles(wallet),
    arbitrator_wallet       VARCHAR(42)     REFERENCES user_profiles(wallet),
    product_id              UUID            NOT NULL REFERENCES products(id),
    token                   token_type      NOT NULL,
    amount                  DECIMAL(18,6)   NOT NULL,       -- Product price
    platform_fee            DECIMAL(18,6)   NOT NULL,       -- 2% of amount
    status                  order_status    NOT NULL DEFAULT 'created',
    product_key_encrypted   TEXT,                           -- Encrypted product key (base64), set on delivery
    tx_hash_create          VARCHAR(66)     NOT NULL,       -- Transaction hash for order creation
    tx_hash_complete        VARCHAR(66),                    -- Transaction hash for completion/resolution
    seller_confirmed_at     TIMESTAMPTZ,
    dispute_opened_at       TIMESTAMPTZ,
    dispute_deadline        TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_amount_min CHECK (amount >= 1.0),
    CONSTRAINT chk_buyer_not_seller CHECK (buyer_wallet != seller_wallet),
    CONSTRAINT uq_onchain_order UNIQUE (chain, onchain_order_id)
);

COMMENT ON TABLE orders IS 'Escrow orders synced from on-chain events. Source of truth is the smart contract.';
COMMENT ON COLUMN orders.onchain_order_id IS 'Matches nextOrderId from P2PEscrow contract';
COMMENT ON COLUMN orders.product_key_encrypted IS 'AES product key encrypted with buyer NaCl pubkey, set by seller on delivery';
```

### messages

End-to-end encrypted messages within an order. The server stores **only ciphertext** — it cannot decrypt.

```sql
CREATE TABLE messages (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID            NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_wallet   VARCHAR(42)     NOT NULL REFERENCES user_profiles(wallet),
    ciphertext      TEXT            NOT NULL,       -- Base64-encoded NaCl box ciphertext
    nonce           VARCHAR(44)     NOT NULL,       -- Base64-encoded NaCl nonce (24 bytes)
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE messages IS 'E2E encrypted messages. Server relays ciphertext only — cannot read content.';
COMMENT ON COLUMN messages.ciphertext IS 'nacl.box(plaintext, nonce, receiverPubKey, senderSecretKey) — base64';
```

### reviews

Post-trade reviews. One review per party per order.

```sql
CREATE TABLE reviews (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID            NOT NULL REFERENCES orders(id),
    reviewer_wallet VARCHAR(42)     NOT NULL REFERENCES user_profiles(wallet),
    target_wallet   VARCHAR(42)     NOT NULL REFERENCES user_profiles(wallet),
    rating          SMALLINT        NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_reviewer_not_target CHECK (reviewer_wallet != target_wallet),
    CONSTRAINT uq_one_review_per_order UNIQUE (order_id, reviewer_wallet)
);

COMMENT ON TABLE reviews IS 'Post-trade ratings. Each party can leave one review per order.';
```

### arbitrators

Mirrors on-chain ArbitratorPool state. Synced via blockchain events.

```sql
CREATE TABLE arbitrators (
    wallet          VARCHAR(42)     PRIMARY KEY REFERENCES user_profiles(wallet),
    stake_amount    DECIMAL(18,6)   NOT NULL,       -- Staked USDT amount
    stake_token     VARCHAR(42)     NOT NULL,       -- Token contract address
    reputation      SMALLINT        NOT NULL DEFAULT 50,    -- 0-100, starts at 50
    total_resolved  INTEGER         NOT NULL DEFAULT 0,
    total_earned    DECIMAL(18,6)   NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    registered_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_reputation_range CHECK (reputation BETWEEN 0 AND 100),
    CONSTRAINT chk_stake_min CHECK (stake_amount >= 500.0)
);

COMMENT ON TABLE arbitrators IS 'Arbitrator registry. Source of truth is ArbitratorPool contract.';
COMMENT ON COLUMN arbitrators.reputation IS 'On-chain reputation: +2 consistent resolution, -5 inconsistent. Deactivated below 10.';
```

### dispute_evidence

Encrypted evidence uploaded to IPFS during disputes.

```sql
CREATE TABLE dispute_evidence (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID            NOT NULL REFERENCES orders(id),
    submitter_wallet    VARCHAR(42)     NOT NULL REFERENCES user_profiles(wallet),
    ipfs_hash           VARCHAR(100)    NOT NULL,   -- IPFS CID (e.g. QmXyz... or bafy...)
    evidence_type       evidence_type   NOT NULL DEFAULT 'other',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE dispute_evidence IS 'Encrypted evidence on IPFS. Content readable only by buyer, seller, and arbitrator.';
COMMENT ON COLUMN dispute_evidence.ipfs_hash IS 'CID pointing to encrypted payload: {encrypted_data, iv, keys:{wallet:encryptedKey}}';
```

### blacklist

Known scam wallets and flagged addresses.

```sql
CREATE TABLE blacklist (
    wallet          VARCHAR(42)     PRIMARY KEY,
    reason          VARCHAR(200)    NOT NULL,
    source          VARCHAR(50)     NOT NULL DEFAULT 'manual',  -- manual | community | tornado
    added_by        VARCHAR(42),                                -- Admin wallet that added
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE blacklist IS 'Blocked wallet addresses. Cross-referenced on auth and order creation.';
```

### event_sync_cursor

Tracks the last processed block per chain to resume event listening after restarts.

```sql
CREATE TABLE event_sync_cursor (
    chain           chain_type      PRIMARY KEY,
    contract        VARCHAR(42)     NOT NULL,       -- Contract address being tracked
    last_block      BIGINT          NOT NULL,       -- Last processed block number
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE event_sync_cursor IS 'Celery event listener bookmark. Prevents replaying events after worker restart.';
```

---

## Indexes

```sql
-- ── user_profiles ──────────────────────────
CREATE INDEX idx_users_tier ON user_profiles(tier);
CREATE INDEX idx_users_rating ON user_profiles(rating DESC NULLS LAST);
CREATE INDEX idx_users_blacklisted ON user_profiles(wallet) WHERE is_blacklisted = TRUE;

-- ── products ───────────────────────────────
CREATE INDEX idx_products_seller ON products(seller_wallet);
CREATE INDEX idx_products_category ON products(category) WHERE status = 'active';
CREATE INDEX idx_products_price ON products(price_usdt) WHERE status = 'active';
CREATE INDEX idx_products_created ON products(created_at DESC) WHERE status = 'active';
CREATE INDEX idx_products_search ON products USING gin(
    (title_preview || ' ' || description_preview) gin_trgm_ops
) WHERE status = 'active';

-- ── orders ─────────────────────────────────
CREATE INDEX idx_orders_buyer ON orders(buyer_wallet);
CREATE INDEX idx_orders_seller ON orders(seller_wallet);
CREATE INDEX idx_orders_arbitrator ON orders(arbitrator_wallet) WHERE arbitrator_wallet IS NOT NULL;
CREATE INDEX idx_orders_product ON orders(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_chain_status ON orders(chain, status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Timeout automation: find orders that need auto-expire or auto-release
CREATE INDEX idx_orders_seller_timeout ON orders(created_at)
    WHERE status = 'created';
CREATE INDEX idx_orders_buyer_timeout ON orders(seller_confirmed_at)
    WHERE status = 'seller_confirmed';

-- ── messages ───────────────────────────────
CREATE INDEX idx_messages_order ON messages(order_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_wallet);

-- ── reviews ────────────────────────────────
CREATE INDEX idx_reviews_target ON reviews(target_wallet);
CREATE INDEX idx_reviews_order ON reviews(order_id);

-- ── dispute_evidence ───────────────────────
CREATE INDEX idx_evidence_order ON dispute_evidence(order_id);

-- ── blacklist ──────────────────────────────
-- PK covers lookup. No additional indexes needed.
```

### Index Strategy Notes

- **Partial indexes** (`WHERE status = 'active'`) used on products to keep index size small — deleted/paused products are rarely queried.
- **Trigram index** (`gin_trgm_ops`) on products enables `ILIKE '%keyword%'` full-text search without a separate search engine.
- **Timeout indexes** are specifically designed for the Celery `timeout_checker` worker which runs periodic queries to find orders that need auto-expiration.
- All foreign key columns are indexed for efficient JOIN operations and ON DELETE CASCADE.

---

## Constraints & Business Rules

### Enforced at Database Level

| Constraint | Table | Rule |
|------------|-------|------|
| `chk_price_min` | products | `price_usdt >= 1.0` |
| `chk_stock_positive` | products | `stock >= 0` |
| `chk_amount_min` | orders | `amount >= 1.0` (mirrors `MIN_ORDER_AMOUNT` on-chain) |
| `chk_buyer_not_seller` | orders | `buyer_wallet != seller_wallet` |
| `uq_onchain_order` | orders | Unique `(chain, onchain_order_id)` — no duplicate sync |
| `chk_rating_range` | reviews | `rating BETWEEN 1 AND 5` |
| `chk_reviewer_not_target` | reviews | Cannot review yourself |
| `uq_one_review_per_order` | reviews | One review per party per order |
| `chk_reputation_range` | arbitrators | `reputation BETWEEN 0 AND 100` |
| `chk_stake_min` | arbitrators | `stake_amount >= 500.0` |

### Enforced at Application Level

These rules are too complex for CHECK constraints and are handled in the service layer:

| Rule | Description |
|------|-------------|
| Order status transitions | Valid transitions only (see [ARCHITECTURE.md](ARCHITECTURE.md)) |
| New seller limits | Max 3 orders/day, max 50 USDT per order for first 7 days |
| Blacklist check | Reject auth and orders from blacklisted wallets |
| Arbitrator conflict of interest | No recent trades with either party |
| Review eligibility | Only after order is `completed`, `resolved_buyer`, or `resolved_seller` |
| Tier auto-update | Recalculated after each completed trade |

---

## Migrations (Alembic)

### Setup

Migration config is in `backend/alembic.ini` and `backend/migrations/`.

```bash
cd backend
source venv/bin/activate

# Check current database revision
alembic current

# View migration history
alembic history --verbose

# Create a new migration after model changes
alembic revision --autogenerate -m "add column display_name to user_profiles"

# Apply all pending migrations
alembic upgrade head

# Apply up to a specific revision
alembic upgrade abc123

# Rollback the last migration
alembic downgrade -1

# Rollback to a specific revision
alembic downgrade abc123

# Rollback all migrations (DANGEROUS)
alembic downgrade base
```

### Migration Best Practices

1. **Always review auto-generated migrations** before applying. Alembic may miss renames or generate incorrect DROP operations.

2. **One migration per change**. Don't bundle unrelated changes.

3. **Forward-compatible migrations** for zero-downtime deploys:
   - Add columns as `NULLABLE` first, deploy code, then add `NOT NULL` with a default in a follow-up migration.
   - Never rename or drop columns in the same deploy as the code change.

4. **Include both `upgrade()` and `downgrade()`**. Every migration must be reversible.

5. **Test migrations** on a staging database clone before applying to production.

Example migration:

```python
"""add display_name to user_profiles

Revision ID: a1b2c3d4
Revises: 9z8y7x6w
Create Date: 2024-02-20 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4'
down_revision = '9z8y7x6w'

def upgrade():
    op.add_column('user_profiles',
        sa.Column('display_name', sa.VARCHAR(50), nullable=True)
    )

def downgrade():
    op.drop_column('user_profiles', 'display_name')
```

### Data Migrations

For backfilling or transforming existing data, use a separate migration with raw SQL:

```python
def upgrade():
    # Backfill tier based on total_trades
    op.execute("""
        UPDATE user_profiles
        SET tier = CASE
            WHEN total_trades >= 100 AND rating >= 4.0 THEN 'trusted'
            WHEN total_trades >= 10 THEN 'standard'
            ELSE 'new'
        END
    """)
```

---

## Connection Management

### SQLAlchemy Async Engine

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,           # Steady-state connections
    max_overflow=10,        # Burst connections (total max = 30)
    pool_timeout=30,        # Wait max 30s for a connection
    pool_recycle=1800,      # Recycle connections every 30 min
    pool_pre_ping=True,     # Verify connection is alive before use
    echo=False,             # True for SQL logging in development
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### Connection Pool Sizing

Rule of thumb: `pool_size = 2-3 × uvicorn_workers` to leave headroom.

| Deployment | Workers | pool_size | max_overflow | Total Max |
|------------|---------|-----------|-------------|-----------|
| Small (1 CPU) | 2 | 10 | 5 | 15 |
| Medium (2 CPU) | 4 | 20 | 10 | 30 |
| Large (4 CPU) | 8 | 30 | 15 | 45 |

**PostgreSQL `max_connections`** must be >= sum of all pools (API + Celery workers + pgBouncer overhead). Recommended: `200` for production.

### pgBouncer (Optional)

For high-traffic deployments, place pgBouncer between the app and PostgreSQL:

```ini
# /etc/pgbouncer/pgbouncer.ini
[databases]
p2p_escrow = host=127.0.0.1 port=5432 dbname=p2p_escrow

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
pool_mode = transaction            # Best for async frameworks
default_pool_size = 50
max_client_conn = 500
```

Update `DATABASE_URL` to point to pgBouncer port `6432` instead of PostgreSQL `5432`.

---

## Read Replicas

For scaling marketplace browsing (read-heavy workload), configure a streaming replica:

### Architecture

```
┌──────────────┐     WAL stream     ┌──────────────┐
│   Primary    │ ──────────────────> │   Replica    │
│  (writes)    │                     │  (reads)     │
│  port 5432   │                     │  port 5433   │
└──────────────┘                     └──────────────┘
       ▲                                    ▲
       │                                    │
   Orders, Auth,                    Product listing,
   Messages, Reviews                Search, Profiles
```

### Backend Configuration

```python
# Route reads to replica, writes to primary
from sqlalchemy.ext.asyncio import create_async_engine

write_engine = create_async_engine(DATABASE_URL)
read_engine = create_async_engine(DATABASE_READ_REPLICA_URL)
```

### Which Queries Go to Replica

| Endpoint | Engine | Reason |
|----------|--------|--------|
| `GET /products` | Read replica | High traffic, eventual consistency OK |
| `GET /products/:id` | Read replica | Public data |
| `GET /profile/:wallet` | Read replica | Public data |
| `POST /auth/*` | Primary | Writes nonce, creates user |
| `POST /orders` | Primary | Transactional write |
| `GET /orders/:id` | Primary | Must be up-to-date for buyer/seller |
| `GET /orders/:id/messages` | Primary | Real-time data |
| `POST /disputes/*` | Primary | Transactional write |

**Replication lag**: Typically < 100ms for streaming replication. Monitor with:

```sql
-- On replica
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

Alert if lag exceeds 5 seconds.

---

## Common Queries

### Marketplace Product Search

```sql
-- Paginated product listing with seller info
SELECT
    p.id, p.title_preview, p.description_preview,
    p.category, p.price_usdt, p.stock, p.total_sold, p.created_at,
    u.wallet AS seller_wallet,
    u.display_name AS seller_display_name,
    u.rating AS seller_rating
FROM products p
JOIN user_profiles u ON u.wallet = p.seller_wallet
WHERE p.status = 'active'
    AND p.deleted_at IS NULL
    AND u.is_blacklisted = FALSE
    AND (p.title_preview || ' ' || p.description_preview) ILIKE '%keyword%'    -- uses gin_trgm index
    AND p.price_usdt BETWEEN :min_price AND :max_price
ORDER BY p.created_at DESC
LIMIT :limit OFFSET :offset;
```

### Orders Requiring Auto-Expiration

Used by `timeout_checker` Celery worker:

```sql
-- Seller timeout: 24h since creation, still in 'created' status
SELECT id, onchain_order_id, chain
FROM orders
WHERE status = 'created'
    AND created_at < NOW() - INTERVAL '24 hours';

-- Buyer timeout: 72h since seller confirmed, still in 'seller_confirmed' status
SELECT id, onchain_order_id, chain
FROM orders
WHERE status = 'seller_confirmed'
    AND seller_confirmed_at < NOW() - INTERVAL '72 hours';
```

### User Reputation Recalculation

```sql
-- Recalculate reputation score for a wallet
WITH stats AS (
    SELECT
        COUNT(*) FILTER (WHERE status IN ('completed','resolved_buyer','resolved_seller'))
            AS total_trades,
        COUNT(*) FILTER (WHERE status = 'resolved_buyer' AND seller_wallet = :wallet)
            + COUNT(*) FILTER (WHERE status = 'resolved_seller' AND buyer_wallet = :wallet)
            AS disputes_lost,
        COUNT(*) FILTER (WHERE status = 'resolved_buyer' AND buyer_wallet = :wallet)
            + COUNT(*) FILTER (WHERE status = 'resolved_seller' AND seller_wallet = :wallet)
            AS disputes_won,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND seller_wallet = :wallet)
            AS seller_cancels,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND buyer_wallet = :wallet)
            AS buyer_cancels
    FROM orders
    WHERE buyer_wallet = :wallet OR seller_wallet = :wallet
),
review_stats AS (
    SELECT COALESCE(COUNT(*) FILTER (WHERE rating = 5), 0) AS five_stars
    FROM reviews WHERE target_wallet = :wallet
)
SELECT
    (s.total_trades * 1)
    + (r.five_stars * 0.5)
    - (s.disputes_lost * 3)
    + (s.disputes_won * 1)
    - (s.seller_cancels * 2)
    - (s.buyer_cancels * 0.5) AS reputation_score,
    s.total_trades
FROM stats s, review_stats r;
```

### Arbitrator Conflict of Interest Check

```sql
-- Check if arbitrator has recent transactions with buyer or seller
SELECT EXISTS (
    SELECT 1 FROM orders
    WHERE (buyer_wallet = :arbitrator OR seller_wallet = :arbitrator)
        AND (buyer_wallet = :buyer OR buyer_wallet = :seller
            OR seller_wallet = :buyer OR seller_wallet = :seller)
        AND created_at > NOW() - INTERVAL '30 days'
) AS has_trade_conflict;

SELECT EXISTS (
    SELECT 1 FROM orders
    WHERE arbitrator_wallet = :arbitrator
        AND (buyer_wallet = :buyer OR buyer_wallet = :seller
            OR seller_wallet = :buyer OR seller_wallet = :seller)
        AND status IN ('resolved_buyer', 'resolved_seller')
        AND updated_at > NOW() - INTERVAL '7 days'
) AS has_dispute_conflict;
```

### Daily Stats (Admin)

```sql
SELECT
    DATE(created_at) AS day,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status IN ('disputed','resolved_buyer','resolved_seller')) AS disputes,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
    SUM(amount) FILTER (WHERE status = 'completed') AS total_volume,
    SUM(platform_fee) FILTER (WHERE status = 'completed') AS total_fees
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

---

## Performance Optimization

### Query Performance Targets

| Query Type | Target (p95) | Max |
|------------|-------------|-----|
| Product listing (paginated) | < 50ms | 200ms |
| Product search (trigram) | < 100ms | 500ms |
| Order lookup by ID | < 10ms | 50ms |
| User profile lookup | < 10ms | 50ms |
| Message history (50 msgs) | < 30ms | 100ms |
| Timeout check scan | < 200ms | 1s |

### Key Optimizations

**1. Partial indexes on active products**

Only products with `status = 'active'` are queried for marketplace browsing. Partial indexes keep the index small:

```sql
-- This index is ~10x smaller than a full index when 80% of products are deleted/paused
CREATE INDEX idx_products_category ON products(category) WHERE status = 'active';
```

**2. Trigram search instead of full-text search**

`pg_trgm` with GIN index supports `ILIKE '%keyword%'` searches without a separate Elasticsearch/Meilisearch instance. Sufficient for our scale (< 1M products).

**3. Covering indexes for hot queries**

If product listing becomes the bottleneck, add a covering index:

```sql
CREATE INDEX idx_products_listing ON products(created_at DESC)
    INCLUDE (id, title_preview, price_usdt, category, seller_wallet, total_sold)
    WHERE status = 'active';
```

**4. Connection pooling**

asyncpg pool + pgBouncer (transaction mode) minimizes connection overhead. See [Connection Management](#connection-management).

**5. Caching layer**

Redis caches hot data to reduce database load (see [ARCHITECTURE.md](ARCHITECTURE.md#caching-strategy)):

| Key Pattern | TTL | Busts On |
|-------------|-----|----------|
| `product:list:{page}:{filter}` | 30s | Product create/update/delete |
| `user:profile:{wallet}` | 5 min | Profile update, trade completion |
| `arb:pool:active` | 1 min | Arbitrator register/withdraw |

### Monitoring Slow Queries

Enable in `postgresql.conf`:

```ini
log_min_duration_statement = 500    # Log queries taking > 500ms
```

Or use `pg_stat_statements` for aggregated stats:

```sql
CREATE EXTENSION pg_stat_statements;

-- Top 10 slowest queries by total time
SELECT
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_ms,
    ROUND(mean_exec_time::numeric, 2) AS mean_ms,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

---

## Maintenance

### Routine Tasks

| Task | Frequency | Command |
|------|-----------|---------|
| VACUUM ANALYZE | Weekly | `vacuumdb -U p2p_user -d p2p_escrow -z` |
| Reindex | Monthly | `reindexdb -U p2p_user -d p2p_escrow` |
| Check bloat | Weekly | Query `pgstattuple` or `pg_stat_user_tables` |
| Check replication lag | Continuous | Monitor `pg_last_xact_replay_timestamp()` |
| Review slow query log | Daily | Check `log_min_duration_statement` output |
| Purge old messages | Monthly | See [data retention](#data-retention) |

### Autovacuum Tuning

Default autovacuum is usually sufficient. For high-write tables (`orders`, `messages`), tune per-table:

```sql
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.05,      -- Vacuum after 5% dead rows (default 20%)
    autovacuum_analyze_scale_factor = 0.02       -- Analyze after 2% changes
);

ALTER TABLE messages SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);
```

### Table Bloat Check

```sql
SELECT
    schemaname, tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

If `dead_pct` exceeds 20% on a table, run manual VACUUM:

```sql
VACUUM (VERBOSE, ANALYZE) orders;
```

### Data Retention

Encrypted messages and expired order data can be purged after a retention period:

```sql
-- Archive messages older than 1 year (completed orders only)
DELETE FROM messages
WHERE order_id IN (
    SELECT id FROM orders
    WHERE status IN ('completed', 'resolved_buyer', 'resolved_seller', 'cancelled', 'expired')
        AND updated_at < NOW() - INTERVAL '1 year'
);

-- Delete soft-deleted products older than 90 days
DELETE FROM products
WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '90 days';
```

Run as a scheduled Celery task or cron job. Always **back up before bulk deletes**.

---

## Backup & Recovery

Full backup procedures are documented in [DEPLOYMENT.md](DEPLOYMENT.md#9-backup--recovery). Key database-specific details:

### Logical Backup (pg_dump)

```bash
# Full backup (custom format, compressible, selective restore)
pg_dump -U p2p_user -Fc p2p_escrow > backup_$(date +%Y%m%d).dump

# Schema only (for reference)
pg_dump -U p2p_user --schema-only p2p_escrow > schema.sql

# Single table backup
pg_dump -U p2p_user -Fc -t orders p2p_escrow > orders_backup.dump
```

### Restore

```bash
# Full restore (drops existing objects)
pg_restore -U p2p_user -d p2p_escrow --clean --if-exists backup.dump

# Restore single table
pg_restore -U p2p_user -d p2p_escrow -t orders orders_backup.dump
```

### Point-in-Time Recovery (PITR)

Requires WAL archiving enabled (`wal_level = replica` in `postgresql.conf`).

```bash
# In recovery.conf (or postgresql.auto.conf for PG 12+)
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = '2024-02-20 10:30:00 UTC'
```

Use PITR when you need to recover to a specific moment (e.g., just before accidental data deletion).

### Backup Schedule

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full pg_dump | Daily 03:00 UTC | 30 days | Local + S3 |
| WAL archive | Continuous | 7 days | S3 |
| Schema snapshot | Each migration | Indefinite | Git repo |

### Backup Verification

Quarterly, restore the latest backup to a staging instance and verify:

```bash
# 1. Create test database
createdb -U postgres p2p_escrow_test

# 2. Restore backup
pg_restore -U postgres -d p2p_escrow_test latest_backup.dump

# 3. Run integrity checks
psql -U postgres -d p2p_escrow_test -c "
    SELECT 'user_profiles' AS tbl, COUNT(*) FROM user_profiles
    UNION ALL
    SELECT 'products', COUNT(*) FROM products
    UNION ALL
    SELECT 'orders', COUNT(*) FROM orders
    UNION ALL
    SELECT 'messages', COUNT(*) FROM messages;
"

# 4. Verify migrations are current
cd backend && DATABASE_URL=...p2p_escrow_test alembic current

# 5. Cleanup
dropdb -U postgres p2p_escrow_test
```
