-- PostgreSQL init script for local development
-- Creates enums and tables matching DATABASE.md schema

-- Enums
CREATE TYPE user_tier AS ENUM ('new', 'standard', 'trusted');
CREATE TYPE product_category AS ENUM ('data', 'accounts', 'tools', 'services', 'other');
CREATE TYPE product_status AS ENUM ('active', 'paused', 'sold_out', 'deleted');
CREATE TYPE chain_type AS ENUM ('bsc', 'ethereum', 'arbitrum', 'base');
CREATE TYPE token_type AS ENUM ('USDT', 'USDC');
CREATE TYPE order_status AS ENUM ('created', 'seller_confirmed', 'completed', 'disputed', 'resolved_buyer', 'resolved_seller', 'cancelled', 'expired');
CREATE TYPE evidence_type AS ENUM ('screenshot', 'conversation', 'product_proof', 'other');

-- User Profiles
CREATE TABLE user_profiles (
    wallet_address VARCHAR(42) PRIMARY KEY,
    public_key VARCHAR(88),
    reputation_score DECIMAL(5,2) DEFAULT 0.00,
    total_trades INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    tier user_tier DEFAULT 'new',
    is_blacklisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet_address),
    title_preview VARCHAR(100) NOT NULL,
    description_preview VARCHAR(500),
    category product_category NOT NULL,
    price_usdt DECIMAL(18,6) NOT NULL CHECK (price_usdt > 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    total_sold INTEGER DEFAULT 0,
    product_hash VARCHAR(66) NOT NULL,
    status product_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_seller ON products(seller_wallet);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status ON products(status);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    onchain_order_id INTEGER,
    chain chain_type NOT NULL DEFAULT 'bsc',
    buyer_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet_address),
    seller_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet_address),
    arbitrator_wallet VARCHAR(42) REFERENCES user_profiles(wallet_address),
    product_id UUID NOT NULL REFERENCES products(id),
    token token_type NOT NULL,
    amount DECIMAL(18,6) NOT NULL CHECK (amount > 0),
    platform_fee DECIMAL(18,6) NOT NULL DEFAULT 0,
    status order_status DEFAULT 'created',
    product_key_encrypted TEXT,
    tx_hash_create VARCHAR(66) NOT NULL,
    tx_hash_complete VARCHAR(66),
    seller_confirmed_at TIMESTAMPTZ,
    dispute_opened_at TIMESTAMPTZ,
    dispute_deadline TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_wallet);
CREATE INDEX idx_orders_seller ON orders(seller_wallet);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_onchain ON orders(onchain_order_id);

-- Messages (E2E encrypted)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    sender_wallet VARCHAR(42) NOT NULL,
    ciphertext TEXT NOT NULL,
    nonce VARCHAR(44) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_order ON messages(order_id);

-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    reviewer_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet_address),
    target_wallet VARCHAR(42) NOT NULL REFERENCES user_profiles(wallet_address),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, reviewer_wallet)
);

CREATE INDEX idx_reviews_target ON reviews(target_wallet);

-- Arbitrators
CREATE TABLE arbitrators (
    wallet_address VARCHAR(42) PRIMARY KEY REFERENCES user_profiles(wallet_address),
    stake DECIMAL(18,6) NOT NULL DEFAULT 0,
    reputation INTEGER NOT NULL DEFAULT 50 CHECK (reputation >= 0 AND reputation <= 100),
    is_active BOOLEAN DEFAULT FALSE,
    active_disputes INTEGER DEFAULT 0,
    total_resolved INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dispute Evidence
CREATE TABLE dispute_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    submitter_wallet VARCHAR(42) NOT NULL,
    ipfs_hash VARCHAR(100) NOT NULL,
    evidence_type evidence_type NOT NULL DEFAULT 'other',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_order ON dispute_evidence(order_id);

-- Blacklist
CREATE TABLE blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL,
    reason TEXT,
    source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- Event Sync Cursor
CREATE TABLE event_sync_cursor (
    chain chain_type PRIMARY KEY,
    last_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed event sync cursor for BSC
INSERT INTO event_sync_cursor (chain, last_block) VALUES ('bsc', 0);
