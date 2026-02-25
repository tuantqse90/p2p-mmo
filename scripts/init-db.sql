-- PostgreSQL init script for local development
-- Creates enums and tables matching SQLAlchemy models exactly
-- NOTE: SQLAlchemy Enum() stores enum NAMES (uppercase) by default

-- Enums (using enum member NAMES as SQLAlchemy sends them)
CREATE TYPE user_tier AS ENUM ('NEW', 'STANDARD', 'TRUSTED');
CREATE TYPE product_category AS ENUM ('DATA', 'ACCOUNTS', 'TOOLS', 'SERVICES', 'OTHER');
CREATE TYPE product_status AS ENUM ('ACTIVE', 'PAUSED', 'SOLD_OUT', 'DELETED');
CREATE TYPE chain_type AS ENUM ('BSC', 'ETHEREUM', 'ARBITRUM', 'BASE');
CREATE TYPE token_type AS ENUM ('USDT', 'USDC');
CREATE TYPE order_status AS ENUM ('CREATED', 'SELLER_CONFIRMED', 'COMPLETED', 'DISPUTED', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CANCELLED', 'EXPIRED');
CREATE TYPE evidence_type AS ENUM ('SCREENSHOT', 'CONVERSATION', 'PRODUCT_PROOF', 'OTHER');

-- User Profiles
CREATE TABLE user_profiles (
    wallet VARCHAR(42) PRIMARY KEY,
    display_name VARCHAR(50),
    public_key VARCHAR(88) NOT NULL,
    reputation_score NUMERIC(6,2) DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    total_as_buyer INTEGER DEFAULT 0,
    total_as_seller INTEGER DEFAULT 0,
    rating NUMERIC(3,2),
    tier user_tier DEFAULT 'NEW',
    is_blacklisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_user_profiles_tier ON user_profiles(tier);
CREATE INDEX ix_user_profiles_rating ON user_profiles(rating);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet),
    title_preview VARCHAR(100) NOT NULL,
    description_preview VARCHAR(500),
    category product_category NOT NULL,
    price_usdt NUMERIC(18,6) NOT NULL CHECK (price_usdt > 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    total_sold INTEGER DEFAULT 0,
    product_hash VARCHAR(66) NOT NULL,
    status product_status DEFAULT 'ACTIVE',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_products_seller ON products(seller_wallet);
CREATE INDEX ix_products_category ON products(category);
CREATE INDEX ix_products_status ON products(status);
CREATE INDEX ix_products_price ON products(price_usdt);
CREATE INDEX ix_products_created_at ON products(created_at);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onchain_order_id BIGINT,
    chain chain_type NOT NULL DEFAULT 'BSC',
    buyer_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet),
    seller_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet),
    arbitrator_wallet VARCHAR(42) REFERENCES user_profiles(wallet),
    product_id UUID NOT NULL REFERENCES products(id),
    token token_type NOT NULL,
    amount NUMERIC(18,6) NOT NULL CHECK (amount > 0),
    platform_fee NUMERIC(18,6) NOT NULL DEFAULT 0,
    status order_status DEFAULT 'CREATED',
    product_key_encrypted TEXT,
    tx_hash_create VARCHAR(66) NOT NULL,
    tx_hash_complete VARCHAR(66),
    seller_confirmed_at TIMESTAMPTZ,
    dispute_opened_at TIMESTAMPTZ,
    dispute_deadline TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain, onchain_order_id)
);

CREATE INDEX ix_orders_buyer ON orders(buyer_wallet);
CREATE INDEX ix_orders_seller ON orders(seller_wallet);
CREATE INDEX ix_orders_arbitrator ON orders(arbitrator_wallet);
CREATE INDEX ix_orders_product ON orders(product_id);
CREATE INDEX ix_orders_status ON orders(status);
CREATE INDEX ix_orders_chain_status ON orders(chain, status);

-- Messages (E2E encrypted)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    sender_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet),
    ciphertext TEXT NOT NULL,
    nonce VARCHAR(44) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_messages_order_created ON messages(order_id, created_at);
CREATE INDEX ix_messages_sender ON messages(sender_wallet);

-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    reviewer_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet),
    target_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet),
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, reviewer_wallet)
);

CREATE INDEX ix_reviews_target ON reviews(target_wallet);
CREATE INDEX ix_reviews_order ON reviews(order_id);

-- Arbitrators
CREATE TABLE arbitrators (
    wallet VARCHAR(42) PRIMARY KEY REFERENCES user_profiles(wallet),
    stake_amount NUMERIC(18,6) NOT NULL,
    stake_token VARCHAR(42) NOT NULL,
    reputation SMALLINT DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
    total_resolved INTEGER DEFAULT 0,
    total_earned NUMERIC(18,6) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dispute Evidence
CREATE TABLE dispute_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    submitter_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet),
    ipfs_hash VARCHAR(100) NOT NULL,
    evidence_type evidence_type NOT NULL DEFAULT 'OTHER',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_dispute_evidence_order ON dispute_evidence(order_id);

-- Blacklist
CREATE TABLE blacklist (
    wallet VARCHAR(42) PRIMARY KEY,
    reason VARCHAR(200) NOT NULL,
    source VARCHAR(50) NOT NULL,
    added_by VARCHAR(42) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Sync Cursor
CREATE TABLE event_sync_cursor (
    chain chain_type NOT NULL,
    contract VARCHAR(42) NOT NULL,
    last_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (chain, contract)
);

-- Seed event sync cursor for BSC (placeholder contract address)
INSERT INTO event_sync_cursor (chain, contract, last_block) VALUES ('BSC', '0x0000000000000000000000000000000000000000', 0);
