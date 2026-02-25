# Environment Variables Reference

Complete reference for all environment variables across backend, frontend, and smart contract services.

## Table of Contents

- [Quick Setup](#quick-setup)
- [Backend (`backend/.env`)](#backend-backendenv)
  - [Application](#application)
  - [Database](#database)
  - [Redis](#redis)
  - [Security & Auth](#security--auth)
  - [Rate Limiting](#rate-limiting)
  - [Blockchain RPC — BSC](#blockchain-rpc--bsc)
  - [Blockchain RPC — Ethereum](#blockchain-rpc--ethereum)
  - [Blockchain RPC — Arbitrum](#blockchain-rpc--arbitrum)
  - [Blockchain RPC — Base](#blockchain-rpc--base)
  - [Smart Contract Addresses](#smart-contract-addresses)
  - [IPFS (Pinata)](#ipfs-pinata)
  - [Celery Workers](#celery-workers)
  - [Logging](#logging)
- [Frontend (`frontend/.env.local`)](#frontend-frontendenvlocal)
  - [API Connection](#api-connection)
  - [Blockchain](#blockchain)
  - [Contract Addresses](#contract-addresses)
  - [IPFS](#ipfs)
- [Smart Contracts (`contracts/.env`)](#smart-contracts-contractsenv)
- [Docker Compose (`.env`)](#docker-compose-env)
- [Per-Environment Overrides](#per-environment-overrides)
- [Generating Secrets](#generating-secrets)
- [Security Checklist](#security-checklist)

---

## Quick Setup

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local

# Smart Contracts
cp contracts/.env.example contracts/.env

# Docker Compose (root)
cp .env.example .env
```

Edit each file with your values. See tables below for every variable.

---

## Backend (`backend/.env`)

### Application

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `APP_ENV` | string | Yes | — | Runtime environment. Controls log level, debug mode, CORS strictness. |
| `APP_DEBUG` | bool | No | `false` | Enable debug mode. **Must be `false` in production.** |
| `APP_HOST` | string | No | `0.0.0.0` | Bind address for Uvicorn. |
| `APP_PORT` | int | No | `8000` | Bind port for Uvicorn. |
| `APP_WORKERS` | int | No | `4` | Number of Uvicorn worker processes. Recommended: `2 × CPU cores`. |
| `CORS_ORIGINS` | string | Yes | — | Comma-separated list of allowed origins. No wildcards in production. |

**`APP_ENV` values:**

| Value | Behavior |
|-------|----------|
| `development` | Debug logging, permissive CORS (`*`), detailed error responses |
| `staging` | Info logging, restricted CORS, generic error responses |
| `production` | Warning logging, strict CORS, generic error responses, security headers enforced |

**Example:**

```bash
APP_ENV=production
APP_DEBUG=false
APP_HOST=0.0.0.0
APP_PORT=8000
APP_WORKERS=4
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

### Database

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DATABASE_URL` | string | Yes | — | PostgreSQL connection string. Must use `asyncpg` driver. |
| `DATABASE_POOL_SIZE` | int | No | `20` | Steady-state connection pool size. See [DATABASE.md](DATABASE.md#connection-management). |
| `DATABASE_MAX_OVERFLOW` | int | No | `10` | Extra connections allowed under burst load. Total max = pool + overflow. |
| `DATABASE_READ_REPLICA_URL` | string | No | — | Optional read replica connection string. Used for `GET /products`, profiles. |

**Connection string format:**

```
postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
```

**Examples:**

```bash
# Local development
DATABASE_URL=postgresql+asyncpg://p2p_user:localpass@localhost:5432/p2p_escrow

# Production with SSL
DATABASE_URL=postgresql+asyncpg://p2p_user:STRONG_PASS@db.internal:5432/p2p_escrow?ssl=require

# With pgBouncer
DATABASE_URL=postgresql+asyncpg://p2p_user:STRONG_PASS@localhost:6432/p2p_escrow

# Read replica
DATABASE_READ_REPLICA_URL=postgresql+asyncpg://p2p_user:STRONG_PASS@db-replica.internal:5432/p2p_escrow
```

---

### Redis

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REDIS_URL` | string | Yes | — | Redis connection string for caching, sessions, pub/sub. |
| `REDIS_CACHE_DB` | int | No | `0` | Redis database number for cache and sessions. |
| `REDIS_CELERY_DB` | int | No | `1` | Redis database number for Celery broker/backend. |

**Connection string format:**

```
redis://:<password>@<host>:<port>/<db>
```

**Examples:**

```bash
# Local (no password)
REDIS_URL=redis://localhost:6379/0

# Production
REDIS_URL=redis://:S3cur3P@ss@redis.internal:6379/0

# Redis Sentinel
REDIS_URL=redis+sentinel://:password@sentinel1:26379,sentinel2:26379/mymaster/0
```

---

### Security & Auth

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `JWT_SECRET` | string | Yes | — | Secret key for signing JWT tokens (HS256). Must be 64+ hex chars. |
| `JWT_EXPIRY_HOURS` | int | No | `24` | JWT token lifetime in hours. |
| `JWT_ALGORITHM` | string | No | `HS256` | JWT signing algorithm. |
| `AUTH_NONCE_TTL` | int | No | `300` | Auth nonce expiry in seconds (5 min default). |
| `AUTH_MESSAGE_PREFIX` | string | No | `P2P-Auth` | Prefix for wallet signature messages. |

**Example:**

```bash
JWT_SECRET=a1b2c3d4e5f6...64_hex_characters...
JWT_EXPIRY_HOURS=24
AUTH_NONCE_TTL=300
```

> **Warning**: Rotating `JWT_SECRET` will invalidate all active sessions. Schedule rotation during low-traffic periods.

---

### Rate Limiting

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `RATE_LIMIT_GLOBAL` | int | No | `100` | Max requests per minute per wallet address. |
| `RATE_LIMIT_AUTH` | int | No | `10` | Max auth requests per minute per IP. |
| `RATE_LIMIT_PRODUCT_CREATE` | int | No | `5` | Max product creation requests per minute per wallet. |
| `RATE_LIMIT_ORDER_CREATE` | int | No | `10` | Max order creation requests per minute per wallet. |
| `RATE_LIMIT_MESSAGE` | int | No | `30` | Max message send requests per minute per wallet. |
| `RATE_LIMIT_WEBSOCKET` | int | No | `1` | Max WebSocket connections per order per wallet. |

**Example:**

```bash
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_AUTH=10
RATE_LIMIT_PRODUCT_CREATE=5
RATE_LIMIT_ORDER_CREATE=10
RATE_LIMIT_MESSAGE=30
```

---

### Blockchain RPC — BSC

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `BSC_RPC_URL` | string | Yes | — | Primary BSC mainnet RPC endpoint. |
| `BSC_RPC_FALLBACK` | string | No | — | Fallback RPC if primary is unresponsive. |
| `BSC_CHAIN_ID` | int | No | `56` | BSC mainnet chain ID. |
| `BSC_BLOCK_CONFIRMATIONS` | int | No | `15` | Required block confirmations before processing events. |

**Example:**

```bash
BSC_RPC_URL=https://bsc-mainnet.nodereal.io/v1/YOUR_API_KEY
BSC_RPC_FALLBACK=https://bsc-dataseed1.binance.org
BSC_CHAIN_ID=56
BSC_BLOCK_CONFIRMATIONS=15
```

---

### Blockchain RPC — Ethereum

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `ETH_RPC_URL` | string | No* | — | Primary Ethereum mainnet RPC endpoint. |
| `ETH_RPC_FALLBACK` | string | No | — | Fallback RPC. |
| `ETH_CHAIN_ID` | int | No | `1` | Ethereum mainnet chain ID. |
| `ETH_BLOCK_CONFIRMATIONS` | int | No | `12` | Required block confirmations. |

*Required only when Ethereum chain is enabled.

**Example:**

```bash
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ETH_RPC_FALLBACK=https://rpc.ankr.com/eth
ETH_CHAIN_ID=1
ETH_BLOCK_CONFIRMATIONS=12
```

---

### Blockchain RPC — Arbitrum

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `ARB_RPC_URL` | string | No* | — | Primary Arbitrum mainnet RPC endpoint. |
| `ARB_RPC_FALLBACK` | string | No | — | Fallback RPC. |
| `ARB_CHAIN_ID` | int | No | `42161` | Arbitrum One chain ID. |
| `ARB_BLOCK_CONFIRMATIONS` | int | No | `1` | Required block confirmations. |

*Required only when Arbitrum chain is enabled.

**Example:**

```bash
ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ARB_CHAIN_ID=42161
ARB_BLOCK_CONFIRMATIONS=1
```

---

### Blockchain RPC — Base

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `BASE_RPC_URL` | string | No* | — | Primary Base mainnet RPC endpoint. |
| `BASE_RPC_FALLBACK` | string | No | — | Fallback RPC. |
| `BASE_CHAIN_ID` | int | No | `8453` | Base chain ID. |
| `BASE_BLOCK_CONFIRMATIONS` | int | No | `1` | Required block confirmations. |

*Required only when Base chain is enabled.

**Example:**

```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BASE_CHAIN_ID=8453
BASE_BLOCK_CONFIRMATIONS=1
```

---

### Smart Contract Addresses

Set per chain. Only chains with valid contract addresses are active.

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `BSC_ESCROW_CONTRACT` | address | Yes | P2PEscrow contract on BSC. |
| `BSC_ARBITRATOR_POOL_CONTRACT` | address | Yes | ArbitratorPool contract on BSC. |
| `BSC_USDT_ADDRESS` | address | Yes | USDT token contract on BSC. |
| `BSC_USDC_ADDRESS` | address | Yes | USDC token contract on BSC. |
| `ETH_ESCROW_CONTRACT` | address | No* | P2PEscrow contract on Ethereum. |
| `ETH_ARBITRATOR_POOL_CONTRACT` | address | No* | ArbitratorPool contract on Ethereum. |
| `ETH_USDT_ADDRESS` | address | No* | USDT token contract on Ethereum. |
| `ETH_USDC_ADDRESS` | address | No* | USDC token contract on Ethereum. |
| `ARB_ESCROW_CONTRACT` | address | No* | P2PEscrow contract on Arbitrum. |
| `ARB_ARBITRATOR_POOL_CONTRACT` | address | No* | ArbitratorPool contract on Arbitrum. |
| `ARB_USDT_ADDRESS` | address | No* | USDT token contract on Arbitrum. |
| `ARB_USDC_ADDRESS` | address | No* | USDC token contract on Arbitrum. |
| `BASE_ESCROW_CONTRACT` | address | No* | P2PEscrow contract on Base. |
| `BASE_ARBITRATOR_POOL_CONTRACT` | address | No* | ArbitratorPool contract on Base. |
| `BASE_USDC_ADDRESS` | address | No* | USDC token contract on Base. (No USDT on Base.) |

*Required when the corresponding chain is enabled.

**Known mainnet token addresses** (for reference):

```bash
# BSC
BSC_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
BSC_USDC_ADDRESS=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

# Ethereum
ETH_USDT_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7
ETH_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Arbitrum
ARB_USDT_ADDRESS=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
ARB_USDC_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831

# Base (USDC only)
BASE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

---

### IPFS (Pinata)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PINATA_API_KEY` | string | Yes | — | Pinata API key for IPFS pinning. |
| `PINATA_SECRET_KEY` | string | Yes | — | Pinata secret key. |
| `PINATA_GATEWAY_URL` | string | No | `https://gateway.pinata.cloud/ipfs` | IPFS gateway URL for reading pinned content. |
| `PINATA_MAX_FILE_SIZE` | int | No | `10485760` | Max file upload size in bytes (default 10 MB). |

**Example:**

```bash
PINATA_API_KEY=abc123def456
PINATA_SECRET_KEY=secret789xyz
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs
PINATA_MAX_FILE_SIZE=10485760
```

---

### Celery Workers

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `CELERY_BROKER_URL` | string | Yes | — | Redis URL for Celery message broker. Should use a separate DB from cache. |
| `CELERY_RESULT_BACKEND` | string | No | Same as broker | Redis URL for storing task results. |
| `CELERY_EVENT_LISTENER_POLL_INTERVAL` | int | No | `3` | Seconds between blockchain event polling cycles. |
| `CELERY_TIMEOUT_CHECK_INTERVAL` | int | No | `60` | Seconds between order timeout scans. |
| `CELERY_WORKER_CONCURRENCY` | int | No | `4` | Number of concurrent Celery worker threads. |
| `CELERY_TASK_SOFT_TIME_LIMIT` | int | No | `300` | Soft time limit per task in seconds. |
| `CELERY_TASK_HARD_TIME_LIMIT` | int | No | `600` | Hard time limit per task in seconds (force kill). |

**Example:**

```bash
CELERY_BROKER_URL=redis://:S3cur3P@ss@redis.internal:6379/1
CELERY_RESULT_BACKEND=redis://:S3cur3P@ss@redis.internal:6379/1
CELERY_EVENT_LISTENER_POLL_INTERVAL=3
CELERY_TIMEOUT_CHECK_INTERVAL=60
CELERY_WORKER_CONCURRENCY=4
```

---

### Logging

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `LOG_LEVEL` | string | No | `INFO` | Python logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR`. |
| `LOG_FORMAT` | string | No | `json` | Log format: `json` (structured, for production) or `text` (human-readable, for dev). |
| `LOG_FILE` | string | No | — | Optional log file path. Logs go to stdout if not set. |
| `SENTRY_DSN` | string | No | — | Sentry error tracking DSN. Disabled if not set. |

**Example:**

```bash
LOG_LEVEL=INFO
LOG_FORMAT=json
SENTRY_DSN=https://abc123@o456.ingest.sentry.io/789
```

---

## Frontend (`frontend/.env.local`)

All frontend variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser bundle. **These values are publicly visible in the client JS** — never put secrets here.

### API Connection

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | string | Yes | — | Backend REST API base URL. |
| `NEXT_PUBLIC_WS_URL` | string | Yes | — | Backend WebSocket base URL. |

**Example:**

```bash
# Production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws

# Local development
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

---

### Blockchain

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NEXT_PUBLIC_DEFAULT_CHAIN` | string | No | `bsc` | Default chain on first visit: `bsc`, `ethereum`, `arbitrum`, `base`. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | string | Yes | — | WalletConnect Cloud project ID for mobile wallet support. |

**How to get WalletConnect Project ID:**

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Create a project
3. Copy the Project ID

**Example:**

```bash
NEXT_PUBLIC_DEFAULT_CHAIN=bsc
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=a1b2c3d4e5f6g7h8i9j0
```

---

### Contract Addresses

Set per chain. The frontend uses these to interact with deployed contracts via wagmi/viem.

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `NEXT_PUBLIC_BSC_ESCROW_CONTRACT` | address | Yes | P2PEscrow on BSC. |
| `NEXT_PUBLIC_BSC_ARBITRATOR_POOL_CONTRACT` | address | Yes | ArbitratorPool on BSC. |
| `NEXT_PUBLIC_ETH_ESCROW_CONTRACT` | address | No* | P2PEscrow on Ethereum. |
| `NEXT_PUBLIC_ETH_ARBITRATOR_POOL_CONTRACT` | address | No* | ArbitratorPool on Ethereum. |
| `NEXT_PUBLIC_ARB_ESCROW_CONTRACT` | address | No* | P2PEscrow on Arbitrum. |
| `NEXT_PUBLIC_ARB_ARBITRATOR_POOL_CONTRACT` | address | No* | ArbitratorPool on Arbitrum. |
| `NEXT_PUBLIC_BASE_ESCROW_CONTRACT` | address | No* | P2PEscrow on Base. |
| `NEXT_PUBLIC_BASE_ARBITRATOR_POOL_CONTRACT` | address | No* | ArbitratorPool on Base. |

*Required when the corresponding chain is enabled.

**Example:**

```bash
NEXT_PUBLIC_BSC_ESCROW_CONTRACT=0x1234567890abcdef1234567890abcdef12345678
NEXT_PUBLIC_BSC_ARBITRATOR_POOL_CONTRACT=0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
```

> **Important**: Contract addresses on frontend **must exactly match** the backend `*_ESCROW_CONTRACT` / `*_ARBITRATOR_POOL_CONTRACT` values. A mismatch will cause transaction failures.

---

### IPFS

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NEXT_PUBLIC_IPFS_GATEWAY` | string | No | `https://gateway.pinata.cloud/ipfs` | IPFS gateway URL for fetching encrypted evidence. |

**Example:**

```bash
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
```

---

## Smart Contracts (`contracts/.env`)

Used by Foundry (forge/cast) for deployment and verification. **Never commit this file.**

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DEPLOYER_PRIVATE_KEY` | hex string | Yes | — | Private key for contract deployment. Use hardware wallet in production. |
| `TREASURY_ADDRESS` | address | Yes | — | Platform fee recipient. Should be a multisig (Gnosis Safe). |
| `BSC_RPC_URL` | string | Yes | — | BSC mainnet RPC for deployment. |
| `BSC_TESTNET_RPC_URL` | string | No | — | BSC testnet RPC for staging deployment. |
| `ETH_RPC_URL` | string | No | — | Ethereum mainnet RPC for deployment. |
| `ARB_RPC_URL` | string | No | — | Arbitrum mainnet RPC for deployment. |
| `BASE_RPC_URL` | string | No | — | Base mainnet RPC for deployment. |
| `BSCSCAN_API_KEY` | string | Yes | — | BscScan API key for contract verification. |
| `ETHERSCAN_API_KEY` | string | No | — | Etherscan API key for ETH/ARB/Base verification. |

**Example:**

```bash
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
TREASURY_ADDRESS=0xYourGnosisSafeMultisigAddress
BSC_RPC_URL=https://bsc-mainnet.nodereal.io/v1/YOUR_KEY
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
BSCSCAN_API_KEY=YOUR_BSCSCAN_KEY
```

> **Production warning**: Never use a plain-text private key for mainnet deployment. Use `--ledger` flag with Foundry for hardware wallet signing, or a cloud KMS.

---

## Docker Compose (`.env`)

Root-level `.env` file used by `docker-compose.yml` for shared variables.

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DB_PASSWORD` | string | Yes | — | PostgreSQL password (used by postgres container). |
| `REDIS_PASSWORD` | string | Yes | — | Redis password (used by redis container). |
| `COMPOSE_PROJECT_NAME` | string | No | `p2p-mmo` | Docker Compose project name prefix. |

**Example:**

```bash
DB_PASSWORD=super_s3cur3_db_p@ss
REDIS_PASSWORD=r3d1s_s3cur3_p@ss
COMPOSE_PROJECT_NAME=p2p-mmo
```

---

## Per-Environment Overrides

Recommended values that differ across environments:

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| `APP_ENV` | `development` | `staging` | `production` |
| `APP_DEBUG` | `true` | `false` | `false` |
| `APP_WORKERS` | `1` | `2` | `2 × CPU cores` |
| `CORS_ORIGINS` | `*` | `https://staging.yourdomain.com` | `https://yourdomain.com` |
| `DATABASE_URL` | `...localhost:5432/p2p_dev` | `...db-staging:5432/p2p_staging` | `...db.internal:5432/p2p_escrow` |
| `DATABASE_POOL_SIZE` | `5` | `10` | `20` |
| `JWT_EXPIRY_HOURS` | `168` (7 days) | `24` | `24` |
| `LOG_LEVEL` | `DEBUG` | `INFO` | `INFO` |
| `LOG_FORMAT` | `text` | `json` | `json` |
| `BSC_CHAIN_ID` | `97` (testnet) | `97` (testnet) | `56` (mainnet) |
| `BSC_BLOCK_CONFIRMATIONS` | `1` | `5` | `15` |
| `CELERY_EVENT_LISTENER_POLL_INTERVAL` | `5` | `3` | `3` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | `https://api-staging.../api` | `https://api.yourdomain.com/api` |
| `NEXT_PUBLIC_DEFAULT_CHAIN` | `bsc` (testnet) | `bsc` (testnet) | `bsc` (mainnet) |
| `SENTRY_DSN` | — (disabled) | Set | Set |

---

## Generating Secrets

```bash
# JWT Secret (64 hex characters)
openssl rand -hex 32

# Database password
openssl rand -base64 24

# Redis password
openssl rand -base64 24

# Generic secure token
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Never reuse secrets across environments.** Each of development, staging, and production should have unique values.

---

## Security Checklist

Before deploying to production, verify:

- [ ] **No secrets in code** — all sensitive values in `.env` files only
- [ ] **`.env` in `.gitignore`** — never committed to version control
- [ ] **`APP_DEBUG=false`** — debug mode disabled in production
- [ ] **`CORS_ORIGINS` set explicitly** — no wildcards (`*`) in production
- [ ] **`JWT_SECRET` is unique** — not the same as staging or dev
- [ ] **`JWT_SECRET` is 64+ hex chars** — sufficient entropy for HS256
- [ ] **Database password is strong** — 24+ characters, generated randomly
- [ ] **Redis password is set** — no passwordless Redis in production
- [ ] **`DEPLOYER_PRIVATE_KEY` removed** — not lingering on production servers after deployment
- [ ] **RPC URLs use dedicated endpoints** — not public free-tier URLs in production
- [ ] **`SENTRY_DSN` configured** — error tracking enabled
- [ ] **Contract addresses match** — backend and frontend point to the same contracts per chain
- [ ] **Token addresses are verified** — match official mainnet contract addresses
- [ ] **`TREASURY_ADDRESS` is a multisig** — not an EOA

### Environment Variable Validation

The backend should validate required variables on startup and fail fast with clear error messages:

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_ENV: str
    DATABASE_URL: str
    REDIS_URL: str
    JWT_SECRET: str
    BSC_RPC_URL: str
    BSC_ESCROW_CONTRACT: str
    BSC_ARBITRATOR_POOL_CONTRACT: str
    PINATA_API_KEY: str
    PINATA_SECRET_KEY: str
    CELERY_BROKER_URL: str
    # ... all required vars

    class Config:
        env_file = ".env"

settings = Settings()  # Raises ValidationError on missing required vars
```
