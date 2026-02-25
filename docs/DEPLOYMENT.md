# Deployment Guide

Production deployment guide for P2P Escrow Privacy Marketplace covering smart contracts, backend, frontend, and infrastructure.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Infrastructure Overview](#infrastructure-overview)
- [Environment Variables Reference](#environment-variables-reference)
- [1. Infrastructure Setup](#1-infrastructure-setup)
- [2. Smart Contract Deployment](#2-smart-contract-deployment)
- [3. Backend Deployment](#3-backend-deployment)
- [4. Frontend Deployment](#4-frontend-deployment)
- [5. Docker Compose (Full Stack)](#5-docker-compose-full-stack)
- [6. SSL/TLS & Domain Setup](#6-ssltls--domain-setup)
- [7. Post-Deployment Verification](#7-post-deployment-verification)
- [8. Monitoring & Alerting](#8-monitoring--alerting)
- [9. Backup & Recovery](#9-backup--recovery)
- [10. Rollback Procedures](#10-rollback-procedures)
- [11. Maintenance & Updates](#11-maintenance--updates)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | 2.20+ | Multi-container orchestration |
| Node.js | 18+ | Frontend build |
| Python | 3.11+ | Backend runtime |
| Foundry | Latest | Smart contract deployment |
| PostgreSQL | 15+ | Primary database |
| Redis | 7+ | Cache, sessions, pub/sub |
| Nginx | 1.24+ | Reverse proxy (if not using Cloudflare) |

**Accounts required:**
- RPC provider (Ankr, QuickNode, or Alchemy)
- Pinata (IPFS pinning)
- Cloudflare (CDN, DDoS protection)
- WalletConnect Cloud (project ID)
- Block explorer API key (BscScan, Etherscan)

---

## Infrastructure Overview

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   CDN + WAF     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌────▼────┐  ┌──────▼──────┐
       │  Frontend   │ │  Nginx  │  │  WebSocket  │
       │  (Vercel /  │ │  Proxy  │  │  (FastAPI)  │
       │   Static)   │ └────┬────┘  └──────┬──────┘
       └─────────────┘      │              │
                      ┌─────▼──────────────▼─────┐
                      │     Backend (FastAPI)     │
                      │     + Celery Workers      │
                      └─────┬──────────────┬─────┘
                            │              │
                     ┌──────▼──────┐ ┌─────▼─────┐
                     │ PostgreSQL  │ │   Redis   │
                     │ (Primary +  │ │ (Cluster) │
                     │  Replica)   │ └───────────┘
                     └─────────────┘
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

```bash
# ──────────────────────────────────────────────
# Application
# ──────────────────────────────────────────────
APP_ENV=production                              # production | staging | development
APP_DEBUG=false                                 # Never true in production
APP_HOST=0.0.0.0
APP_PORT=8000
APP_WORKERS=4                                   # Uvicorn workers (2 × CPU cores)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ──────────────────────────────────────────────
# Database (PostgreSQL)
# ──────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://p2p_user:STRONG_PASSWORD@db-host:5432/p2p_escrow
DATABASE_POOL_SIZE=20                           # Connection pool size
DATABASE_MAX_OVERFLOW=10                        # Extra connections under load
DATABASE_READ_REPLICA_URL=                      # Optional read replica

# ──────────────────────────────────────────────
# Redis
# ──────────────────────────────────────────────
REDIS_URL=redis://:REDIS_PASSWORD@redis-host:6379/0
REDIS_CACHE_DB=0
REDIS_CELERY_DB=1

# ──────────────────────────────────────────────
# Security
# ──────────────────────────────────────────────
JWT_SECRET=<random-64-char-hex-string>          # openssl rand -hex 32
JWT_EXPIRY_HOURS=24
RATE_LIMIT_GLOBAL=100                           # Requests per minute per wallet

# ──────────────────────────────────────────────
# Blockchain RPC
# ──────────────────────────────────────────────
BSC_RPC_URL=https://bsc-mainnet.nodereal.io/v1/YOUR_API_KEY
BSC_RPC_FALLBACK=https://bsc-dataseed1.binance.org
BSC_CHAIN_ID=56
BSC_BLOCK_CONFIRMATIONS=15

ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ETH_RPC_FALLBACK=https://rpc.ankr.com/eth
ETH_CHAIN_ID=1
ETH_BLOCK_CONFIRMATIONS=12

ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ARB_CHAIN_ID=42161
ARB_BLOCK_CONFIRMATIONS=1

# ──────────────────────────────────────────────
# Smart Contract Addresses
# ──────────────────────────────────────────────
BSC_ESCROW_CONTRACT=0x...
BSC_ARBITRATOR_POOL_CONTRACT=0x...
BSC_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
BSC_USDC_ADDRESS=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

# ──────────────────────────────────────────────
# IPFS (Pinata)
# ──────────────────────────────────────────────
PINATA_API_KEY=your_api_key
PINATA_SECRET_KEY=your_secret_key
PINATA_GATEWAY_URL=https://gateway.pinata.cloud/ipfs

# ──────────────────────────────────────────────
# Celery
# ──────────────────────────────────────────────
CELERY_BROKER_URL=redis://:REDIS_PASSWORD@redis-host:6379/1
CELERY_RESULT_BACKEND=redis://:REDIS_PASSWORD@redis-host:6379/1
CELERY_EVENT_LISTENER_POLL_INTERVAL=3           # Seconds between blockchain polls
CELERY_TIMEOUT_CHECK_INTERVAL=60                # Seconds between timeout checks
```

### Frontend (`frontend/.env.local`)

```bash
# ──────────────────────────────────────────────
# API
# ──────────────────────────────────────────────
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws

# ──────────────────────────────────────────────
# Blockchain
# ──────────────────────────────────────────────
NEXT_PUBLIC_DEFAULT_CHAIN=bsc
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# BSC
NEXT_PUBLIC_BSC_ESCROW_CONTRACT=0x...
NEXT_PUBLIC_BSC_ARBITRATOR_POOL_CONTRACT=0x...

# ──────────────────────────────────────────────
# IPFS
# ──────────────────────────────────────────────
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
```

### Smart Contracts (`contracts/.env`)

```bash
# ──────────────────────────────────────────────
# Deployment
# ──────────────────────────────────────────────
DEPLOYER_PRIVATE_KEY=0x...                      # Use hardware wallet in production
BSC_RPC_URL=https://bsc-mainnet.nodereal.io/v1/YOUR_API_KEY
BSCSCAN_API_KEY=your_bscscan_key
TREASURY_ADDRESS=0x...                          # Platform fee recipient (multisig)

# Testnet (BSC Testnet)
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
```

---

## 1. Infrastructure Setup

### PostgreSQL

```bash
# Create database and user
psql -U postgres <<SQL
CREATE USER p2p_user WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE p2p_escrow OWNER p2p_user;
GRANT ALL PRIVILEGES ON DATABASE p2p_escrow TO p2p_user;

-- Enable required extensions
\c p2p_escrow
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- For text search
SQL
```

**Production settings** (`postgresql.conf`):

```ini
# Connection
max_connections = 200
shared_buffers = 2GB                            # 25% of total RAM
effective_cache_size = 6GB                      # 75% of total RAM

# WAL & Replication
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1GB

# Performance
work_mem = 64MB
maintenance_work_mem = 512MB
random_page_cost = 1.1                          # For SSD storage

# Logging
log_min_duration_statement = 500                # Log slow queries > 500ms
log_connections = on
log_disconnections = on
```

**Backup cron** (daily):

```bash
# /etc/cron.d/p2p-backup
0 3 * * * postgres pg_dump -Fc p2p_escrow | gzip > /backups/p2p_escrow_$(date +\%Y\%m\%d).dump.gz
0 4 * * * find /backups -name "*.dump.gz" -mtime +30 -delete
```

### Redis

```bash
# /etc/redis/redis.conf (key production settings)
bind 127.0.0.1                                  # Only local access
requirepass REDIS_PASSWORD
maxmemory 1gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

### RPC Nodes

Recommended setup per chain with primary + fallback:

| Chain | Primary | Fallback | Notes |
|-------|---------|----------|-------|
| BSC | NodeReal / QuickNode | `bsc-dataseed1.binance.org` | Free tier: ~300 req/s |
| Ethereum | Alchemy | Ankr | Alchemy: 300M CU/month free |
| Arbitrum | Alchemy | Ankr | Low confirmation time |

**Tip**: Always configure at least 2 RPC endpoints per chain. The backend should auto-failover if the primary is unresponsive.

---

## 2. Smart Contract Deployment

### Testnet First (BSC Testnet)

```bash
cd contracts

# Load environment
source .env

# Deploy to BSC testnet
forge script script/Deploy.s.sol \
  --rpc-url $BSC_TESTNET_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BSCSCAN_API_KEY

# Note deployed addresses from output:
# P2PEscrow deployed at: 0x...
# ArbitratorPool deployed at: 0x...
```

### Configure Contracts

```bash
# Set supported tokens
cast send $ESCROW_ADDRESS \
  "setSupportedToken(address,bool)" \
  $BSC_USDT_ADDRESS true \
  --rpc-url $BSC_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

cast send $ESCROW_ADDRESS \
  "setSupportedToken(address,bool)" \
  $BSC_USDC_ADDRESS true \
  --rpc-url $BSC_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# Set treasury (multisig wallet)
cast send $ESCROW_ADDRESS \
  "setTreasury(address)" \
  $TREASURY_ADDRESS \
  --rpc-url $BSC_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY

# Link ArbitratorPool to Escrow
cast send $ESCROW_ADDRESS \
  "setArbitratorPool(address)" \
  $ARBITRATOR_POOL_ADDRESS \
  --rpc-url $BSC_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY
```

### Verify on Block Explorer

```bash
forge verify-contract $ESCROW_ADDRESS P2PEscrow \
  --chain bsc \
  --etherscan-api-key $BSCSCAN_API_KEY

forge verify-contract $ARBITRATOR_POOL_ADDRESS ArbitratorPool \
  --chain bsc \
  --etherscan-api-key $BSCSCAN_API_KEY
```

### Mainnet Deployment

Repeat the same steps with mainnet RPC URL. **Critical checklist before mainnet:**

- [ ] All tests pass (`forge test`)
- [ ] Coverage >= 95% (`forge coverage`)
- [ ] Gas report reviewed (`forge test --gas-report`)
- [ ] Testnet deployment verified and tested end-to-end
- [ ] Contract code reviewed by at least 2 team members
- [ ] External audit completed (recommended)
- [ ] Deployer uses hardware wallet or KMS
- [ ] Treasury is a multisig wallet (Gnosis Safe)
- [ ] Emergency `pause()` tested on testnet

---

## 3. Backend Deployment

### Option A: Docker (Recommended)

**Dockerfile** (`backend/Dockerfile`):

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

Build and run:

```bash
cd backend

# Build image
docker build -t p2p-backend:latest .

# Run API server
docker run -d \
  --name p2p-api \
  --env-file .env \
  -p 8000:8000 \
  --restart unless-stopped \
  p2p-backend:latest

# Run Celery event listener
docker run -d \
  --name p2p-event-listener \
  --env-file .env \
  --restart unless-stopped \
  p2p-backend:latest \
  celery -A app.workers worker -Q events -c 2 --loglevel=info

# Run Celery timeout checker
docker run -d \
  --name p2p-timeout-checker \
  --env-file .env \
  --restart unless-stopped \
  p2p-backend:latest \
  celery -A app.workers worker -Q timeouts -c 1 --loglevel=info

# Run Celery beat (scheduler)
docker run -d \
  --name p2p-celery-beat \
  --env-file .env \
  --restart unless-stopped \
  p2p-backend:latest \
  celery -A app.workers beat --loglevel=info
```

### Option B: Systemd (Bare Metal)

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head
```

**Systemd service** (`/etc/systemd/system/p2p-api.service`):

```ini
[Unit]
Description=P2P Escrow API
After=network.target postgresql.service redis.service

[Service]
Type=exec
User=p2p
Group=p2p
WorkingDirectory=/opt/p2p-mmo/backend
EnvironmentFile=/opt/p2p-mmo/backend/.env
ExecStart=/opt/p2p-mmo/backend/venv/bin/uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Celery worker service** (`/etc/systemd/system/p2p-celery.service`):

```ini
[Unit]
Description=P2P Escrow Celery Worker
After=network.target redis.service

[Service]
Type=exec
User=p2p
Group=p2p
WorkingDirectory=/opt/p2p-mmo/backend
EnvironmentFile=/opt/p2p-mmo/backend/.env
ExecStart=/opt/p2p-mmo/backend/venv/bin/celery \
  -A app.workers worker \
  -Q events,timeouts \
  -c 4 \
  --loglevel=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Celery beat service** (`/etc/systemd/system/p2p-celery-beat.service`):

```ini
[Unit]
Description=P2P Escrow Celery Beat Scheduler
After=network.target redis.service

[Service]
Type=exec
User=p2p
Group=p2p
WorkingDirectory=/opt/p2p-mmo/backend
EnvironmentFile=/opt/p2p-mmo/backend/.env
ExecStart=/opt/p2p-mmo/backend/venv/bin/celery \
  -A app.workers beat \
  --loglevel=info
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now p2p-api p2p-celery p2p-celery-beat
```

### Database Migrations

```bash
cd backend
source venv/bin/activate

# Create migration (after model changes)
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Check current revision
alembic current

# Rollback one step
alembic downgrade -1
```

---

## 4. Frontend Deployment

### Option A: Vercel (Recommended)

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or connect to Git for auto-deploy:
# 1. Push to GitHub
# 2. Import project on vercel.com
# 3. Set environment variables in Vercel dashboard
# 4. Auto-deploys on push to main
```

**Vercel environment variables** (set in dashboard):

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws
NEXT_PUBLIC_DEFAULT_CHAIN=bsc
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxx
NEXT_PUBLIC_BSC_ESCROW_CONTRACT=0x...
NEXT_PUBLIC_BSC_ARBITRATOR_POOL_CONTRACT=0x...
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
```

### Option B: Docker

**Dockerfile** (`frontend/Dockerfile`):

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
```

**Next.js config** (enable standalone output in `next.config.js`):

```js
module.exports = {
  output: 'standalone',
};
```

Build and run:

```bash
cd frontend
docker build -t p2p-frontend:latest .
docker run -d \
  --name p2p-frontend \
  -p 3000:3000 \
  --restart unless-stopped \
  p2p-frontend:latest
```

### Option C: Static Export + Nginx

```bash
cd frontend
npm run build
# Output in .next/ or out/ directory
```

Serve with Nginx (see [SSL/TLS section](#6-ssltls--domain-setup) for full config).

---

## 5. Docker Compose (Full Stack)

**`docker-compose.yml`** (production):

```yaml
version: "3.8"

services:
  # ── Database ──────────────────────────────
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: p2p_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: p2p_escrow
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U p2p_user -d p2p_escrow"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis ─────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Backend API ───────────────────────────
  api:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    ports:
      - "127.0.0.1:8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ── Celery Event Listener ─────────────────
  celery-events:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    command: celery -A app.workers worker -Q events -c 2 --loglevel=info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # ── Celery Timeout Checker ────────────────
  celery-timeouts:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    command: celery -A app.workers worker -Q timeouts -c 1 --loglevel=info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # ── Celery Beat (Scheduler) ───────────────
  celery-beat:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    command: celery -A app.workers beat --loglevel=info
    depends_on:
      redis:
        condition: service_healthy

  # ── Frontend ──────────────────────────────
  frontend:
    build: ./frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"

  # ── Nginx Reverse Proxy ───────────────────
  nginx:
    image: nginx:1.24-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
      - frontend

volumes:
  pgdata:
  redisdata:
```

**Run:**

```bash
# Start all services
docker compose up -d

# Run database migrations
docker compose exec api alembic upgrade head

# View logs
docker compose logs -f api celery-events

# Scale Celery workers
docker compose up -d --scale celery-events=3
```

---

## 6. SSL/TLS & Domain Setup

### DNS Configuration

```
# A records
yourdomain.com        → frontend server IP (or Cloudflare proxy)
www.yourdomain.com    → frontend server IP
api.yourdomain.com    → backend server IP

# If using Cloudflare, enable orange cloud (proxy) on all records
```

### Nginx Configuration

**`nginx/nginx.conf`**:

```nginx
upstream api_backend {
    server api:8000;
}

upstream frontend_app {
    server frontend:3000;
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Frontend
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Content-Type-Options    nosniff;
    add_header X-Frame-Options           DENY;
    add_header X-XSS-Protection          "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy           strict-origin-when-cross-origin;

    location / {
        proxy_pass http://frontend_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API + WebSocket
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Content-Type-Options    nosniff;
    add_header X-Frame-Options           DENY;
    add_header X-XSS-Protection          "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API routes
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Rate limiting (backup — primary in FastAPI)
        limit_req zone=api burst=20 nodelay;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Health check (no auth)
    location /health {
        proxy_pass http://api_backend/health;
    }
}
```

### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Auto-renewal (certbot installs cron automatically)
sudo certbot renew --dry-run
```

### Cloudflare Setup

1. Add domain to Cloudflare and update nameservers
2. Enable **Full (strict)** SSL mode
3. Enable **Always Use HTTPS**
4. Configure WAF rules:
   - Rate limiting: 100 requests/10s per IP to `/api/*`
   - Block known bad user agents
   - Enable Bot Fight Mode
5. Enable **Under Attack Mode** if needed (high dispute rate, DDoS)
6. Page rules:
   - `api.yourdomain.com/*` → Cache Level: Bypass
   - `yourdomain.com/marketplace*` → Cache Level: Standard, Edge TTL: 30s

---

## 7. Post-Deployment Verification

Run through this checklist after every production deployment:

### Infrastructure

- [ ] PostgreSQL accepts connections: `pg_isready -h db-host -p 5432`
- [ ] Redis responds: `redis-cli -h redis-host -a PASSWORD ping`
- [ ] All Docker containers running: `docker compose ps`
- [ ] No restart loops in container logs

### Backend

- [ ] Health endpoint responds: `curl https://api.yourdomain.com/health`
- [ ] Auth flow works: request nonce → sign → verify → receive JWT
- [ ] Database migrations applied: `docker compose exec api alembic current`
- [ ] Celery workers active: `docker compose exec celery-events celery -A app.workers inspect active`
- [ ] Celery beat scheduling: check logs for periodic task execution

### Smart Contracts

- [ ] Contracts verified on block explorer
- [ ] Supported tokens configured: `cast call $ESCROW "supportedTokens(address)" $USDT_ADDRESS`
- [ ] Treasury set correctly: `cast call $ESCROW "treasury()"`
- [ ] ArbitratorPool linked: `cast call $ESCROW "arbitratorPool()"`
- [ ] Contract not paused: `cast call $ESCROW "paused()"`

### Frontend

- [ ] Site loads: `curl -I https://yourdomain.com`
- [ ] Wallet connect works (test with MetaMask)
- [ ] Marketplace page loads products
- [ ] WebSocket connection established (check browser DevTools)

### End-to-End

- [ ] Create a test order on testnet (or mainnet with minimum amount)
- [ ] Seller confirm delivery flow works
- [ ] Buyer confirm receipt flow works
- [ ] Encrypted messages send and receive correctly
- [ ] WebSocket notifications arrive in real time

---

## 8. Monitoring & Alerting

### Health Checks

Implement a `/health` endpoint that returns:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "celery": "ok",
    "rpc_bsc": "ok"
  }
}
```

### Key Metrics to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| API response time (p95) | > 500ms | > 2s |
| API error rate (5xx) | > 1% | > 5% |
| Database connections | > 80% pool | > 95% pool |
| Redis memory usage | > 70% | > 90% |
| Celery task queue depth | > 100 | > 500 |
| RPC request failures | > 5% | > 20% |
| Disk usage | > 80% | > 95% |
| SSL certificate expiry | < 14 days | < 3 days |

### Recommended Stack

- **Uptime**: UptimeRobot or Better Uptime (free tier)
- **Metrics**: Prometheus + Grafana (self-hosted) or Datadog
- **Logs**: Loki + Grafana or CloudWatch
- **Alerts**: PagerDuty, Opsgenie, or Telegram/Discord webhook

### Basic Alerting with Cron

```bash
# /etc/cron.d/p2p-health-check
*/5 * * * * root curl -sf https://api.yourdomain.com/health || \
  curl -X POST "https://hooks.slack.com/services/XXX" \
  -d '{"text":"P2P API health check failed!"}'
```

---

## 9. Backup & Recovery

### Automated Backups

```bash
#!/bin/bash
# /opt/p2p-mmo/scripts/backup.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/p2p"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# PostgreSQL dump
echo "Backing up PostgreSQL..."
docker compose exec -T postgres pg_dump -U p2p_user -Fc p2p_escrow \
  > "$BACKUP_DIR/db_${TIMESTAMP}.dump"

# Redis snapshot
echo "Backing up Redis..."
docker compose exec -T redis redis-cli -a "$REDIS_PASSWORD" BGSAVE
sleep 5
docker cp p2p-redis:/data/dump.rdb "$BACKUP_DIR/redis_${TIMESTAMP}.rdb"

# Compress
gzip "$BACKUP_DIR/db_${TIMESTAMP}.dump"
gzip "$BACKUP_DIR/redis_${TIMESTAMP}.rdb"

# Upload to remote storage (S3 / Backblaze B2)
# aws s3 cp "$BACKUP_DIR/db_${TIMESTAMP}.dump.gz" s3://p2p-backups/db/
# aws s3 cp "$BACKUP_DIR/redis_${TIMESTAMP}.rdb.gz" s3://p2p-backups/redis/

# Cleanup old backups
find "$BACKUP_DIR" -name "*.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: $TIMESTAMP"
```

**Schedule**: `0 3 * * * /opt/p2p-mmo/scripts/backup.sh >> /var/log/p2p-backup.log 2>&1`

### Recovery Procedures

**Database restore:**

```bash
# Stop API and Celery first
docker compose stop api celery-events celery-timeouts celery-beat

# Restore from dump
gunzip -k /backups/p2p/db_YYYYMMDD_HHMMSS.dump.gz
docker compose exec -T postgres pg_restore \
  -U p2p_user \
  -d p2p_escrow \
  --clean --if-exists \
  < /backups/p2p/db_YYYYMMDD_HHMMSS.dump

# Run any pending migrations
docker compose exec api alembic upgrade head

# Restart services
docker compose start api celery-events celery-timeouts celery-beat
```

**Redis restore:**

```bash
docker compose stop redis
docker cp /backups/p2p/redis_YYYYMMDD_HHMMSS.rdb p2p-redis:/data/dump.rdb
docker compose start redis
```

---

## 10. Rollback Procedures

### Backend Rollback

```bash
# Keep previous image tagged
docker tag p2p-backend:latest p2p-backend:previous

# Build new version
docker build -t p2p-backend:latest ./backend

# If something goes wrong, rollback:
docker tag p2p-backend:previous p2p-backend:latest
docker compose up -d api celery-events celery-timeouts celery-beat

# Rollback database migration if needed
docker compose exec api alembic downgrade -1
```

### Frontend Rollback

**Vercel**: Use the dashboard to instantly rollback to a previous deployment.

**Docker**:

```bash
docker tag p2p-frontend:previous p2p-frontend:latest
docker compose up -d frontend
```

### Smart Contract

Smart contracts are immutable once deployed. For critical bugs:

1. **Pause** the contract immediately: `cast send $ESCROW "pause()" --private-key $KEY`
2. Deploy a **new version** of the contract
3. Update backend and frontend to point to new contract address
4. Migrate active orders manually if needed (admin functions)
5. **Unpause** new contract after verification

---

## 11. Maintenance & Updates

### Routine Maintenance

| Task | Frequency | Command / Action |
|------|-----------|-----------------|
| Check logs for errors | Daily | `docker compose logs --since 24h api celery-events` |
| Review pending disputes | Daily | Admin dashboard or database query |
| Database vacuum | Weekly | `docker compose exec postgres vacuumdb -U p2p_user -d p2p_escrow -z` |
| Update dependencies | Monthly | `pip install --upgrade`, `npm update` |
| Rotate JWT secret | Monthly | Update `JWT_SECRET` env var, restart API |
| Review rate limit thresholds | Monthly | Check for false positives in logs |
| SSL certificate renewal | Auto (certbot) | Verify with `certbot renew --dry-run` |
| Full backup test restore | Quarterly | Restore backup to staging and verify data |

### Zero-Downtime Deployment

```bash
# 1. Build new images
docker build -t p2p-backend:new ./backend
docker build -t p2p-frontend:new ./frontend

# 2. Run migrations (safe for zero-downtime if forward-compatible)
docker run --rm --env-file ./backend/.env p2p-backend:new alembic upgrade head

# 3. Rolling restart
docker tag p2p-backend:latest p2p-backend:previous
docker tag p2p-backend:new p2p-backend:latest

docker compose up -d --no-deps api
docker compose up -d --no-deps celery-events celery-timeouts celery-beat
docker compose up -d --no-deps frontend

# 4. Verify
curl -sf https://api.yourdomain.com/health
```

### Adding a New Chain

When deploying contracts to a new chain, follow this order:

1. Deploy and verify contracts on the new chain (see [Smart Contract Deployment](#2-smart-contract-deployment))
2. Add chain config to backend `.env` (RPC URL, chain ID, confirmations, contract addresses)
3. Add a new Celery event listener worker for the chain
4. Add chain to frontend config (wagmi chain, contract addresses)
5. Update Cloudflare rules if needed
6. Test full flow on testnet before mainnet
7. Update docs (README chain support table)

---

## Quick Reference

### Common Commands

```bash
# View all service status
docker compose ps

# Tail logs (all services)
docker compose logs -f

# Restart a single service
docker compose restart api

# Scale Celery workers
docker compose up -d --scale celery-events=3

# Enter a container shell
docker compose exec api bash

# Check database migrations
docker compose exec api alembic current
docker compose exec api alembic history

# Monitor Celery
docker compose exec celery-events celery -A app.workers inspect active
docker compose exec celery-events celery -A app.workers inspect reserved

# Emergency: Pause smart contract
cast send $ESCROW "pause()" --rpc-url $BSC_RPC_URL --private-key $KEY
```

### Port Map

| Service | Internal Port | External Port | Notes |
|---------|--------------|---------------|-------|
| PostgreSQL | 5432 | 127.0.0.1:5432 | Local only |
| Redis | 6379 | 127.0.0.1:6379 | Local only |
| Backend API | 8000 | 127.0.0.1:8000 | Behind Nginx |
| Frontend | 3000 | 127.0.0.1:3000 | Behind Nginx |
| Nginx HTTP | 80 | 0.0.0.0:80 | Redirects to HTTPS |
| Nginx HTTPS | 443 | 0.0.0.0:443 | Public |
