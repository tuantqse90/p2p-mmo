# P2P Escrow Privacy Marketplace

A decentralized, non-custodial marketplace for digital products with built-in escrow, end-to-end encryption, and on-chain dispute resolution.

## Overview

P2P Escrow Privacy Marketplace enables trustless peer-to-peer trading of digital products (email lists, data, accounts, MMO tools) using USDT/USDC payments locked in smart contracts. No KYC, no email registration — wallet-only authentication with full privacy preservation.

### Key Principles

- **Non-custodial** — Platform never holds user funds. All payments locked in smart contracts.
- **Wallet-only auth** — No email, no passwords, no KYC. Connect wallet to start.
- **Privacy-first** — End-to-end encryption, no PII stored, no IP logging.
- **Trustless P2P** — Smart contract escrow with automated timeouts and on-chain arbitration.

## How It Works

```
┌─────────┐     ┌──────────────────┐     ┌──────────┐
│  Buyer  │────>│  Smart Contract  │<────│  Seller  │
│         │     │  (Escrow Lock)   │     │          │
└────┬────┘     └────────┬─────────┘     └────┬─────┘
     │                   │                    │
     │  1. Lock USDT     │  3. Confirm        │
     │     + 2% fee      │     delivery       │
     │                   │                    │
     │  4. Confirm       │  5. Release        │
     │     received      │     payment        │
     │                   │                    │
     │         ┌─────────┴─────────┐          │
     │         │    Arbitrator     │          │
     │         │  (if disputed)    │          │
     │         └───────────────────┘          │
```

### Transaction Flow

1. **Seller** lists a digital product with encrypted data and sets USDT/USDC price
2. **Buyer** selects product → approves token → locks `price + 2% platform fee` into escrow
3. **Seller** receives notification → delivers product (encrypted) → calls `sellerConfirmDelivery()`
4. **Buyer** verifies product → calls `buyerConfirmReceived()`
5. **Smart contract** releases payment to seller, platform fee to treasury
6. Transaction complete

### Dispute Resolution

If either party is unsatisfied:

1. Either party calls `openDispute()` with encrypted evidence (stored on IPFS)
2. A weighted-random arbitrator is assigned from the staked arbitrator pool
3. Both parties submit evidence (encrypted, readable only by involved parties + arbitrator)
4. Arbitrator reviews and calls `resolveDispute(orderId, favorBuyer)`
5. Winner receives funds minus 5% arbitration fee
6. Arbitrator earns the 5% arbitration fee

### Timeouts

| Scenario | Timeout | Action |
|----------|---------|--------|
| Seller doesn't confirm delivery | 24 hours | Auto-cancel, refund buyer |
| Buyer doesn't confirm/dispute after delivery | 72 hours | Auto-release to seller |
| Dispute resolution window | 7 days | Arbitrator must resolve |

## Tech Stack

### Smart Contracts
- **Solidity ^0.8.20** — EVM-compatible (BSC, Ethereum, Arbitrum, Base)
- **OpenZeppelin** — ReentrancyGuard, SafeERC20, Ownable, Pausable
- **Foundry** — Development, testing, deployment

### Backend
- **Python FastAPI** — REST API + WebSocket
- **PostgreSQL** — Primary database
- **Redis** — Cache, sessions, pub/sub for WebSocket
- **Celery** — Background tasks (blockchain event listeners, notifications)
- **web3.py** — Blockchain interaction
- **PyNaCl** — Server-side encryption utilities

### Frontend
- **Next.js 14+** — App Router, TypeScript, strict mode
- **wagmi v2 + viem** — EVM wallet interaction
- **RainbowKit** — Wallet connect UI
- **shadcn/ui + TailwindCSS** — UI components
- **tweetnacl-js** — Client-side E2E encryption
- **Zustand** — State management

### Infrastructure
- **IPFS** (Pinata) — Encrypted evidence storage
- **Cloudflare** — CDN, DDoS protection
- **RPC Nodes** — Ankr/QuickNode (BSC), Alchemy (Ethereum/Arbitrum/Base)

## Project Structure

```
p2p-mmo/
├── contracts/              # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── P2PEscrow.sol
│   │   ├── ArbitratorPool.sol
│   │   └── interfaces/
│   ├── test/
│   ├── script/
│   └── foundry.toml
├── backend/                # Python FastAPI backend
│   ├── app/
│   │   ├── api/            # Route handlers
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   ├── core/           # Config, security, deps
│   │   └── workers/        # Celery tasks
│   ├── migrations/         # Alembic migrations
│   └── requirements.txt
├── frontend/               # Next.js 14+ frontend
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks (blockchain, encryption)
│   │   ├── lib/            # Utilities, encryption, config
│   │   └── stores/         # Zustand stores
│   └── package.json
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SMART-CONTRACT.md
│   ├── ENCRYPTION.md
│   └── SECURITY.md
├── CONTRIBUTING.md
└── README.md
```

## Quick Start

### Prerequisites

- Node.js >= 18
- Python >= 3.11
- Foundry (forge, cast, anvil)
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### 1. Smart Contracts

```bash
cd contracts
forge install
forge build
forge test
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database URL, Redis URL, RPC endpoints

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with API URL, contract addresses, WalletConnect project ID

# Start dev server
npm run dev
```

### 4. Docker (All services)

```bash
docker-compose up -d
```

## Fee Structure

| Fee | Rate | Paid By | Recipient |
|-----|------|---------|-----------|
| Platform fee | 2% | Buyer (on top of price) | Treasury |
| Arbitration fee | 5% | Deducted from order amount | Arbitrator |

## Supported Chains

| Chain | Token | Status |
|-------|-------|--------|
| BNB Smart Chain | USDT, USDC | Primary |
| Ethereum | USDT, USDC | Planned |
| Arbitrum | USDT, USDC | Planned |
| Base | USDC | Planned |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data flows, sequence diagrams
- [API Reference](docs/API.md) — All endpoints, request/response formats, WebSocket events
- [Smart Contract](docs/SMART-CONTRACT.md) — Contract interface, events, deployment
- [Encryption](docs/ENCRYPTION.md) — E2E encryption scheme, key derivation, privacy model
- [Security](docs/SECURITY.md) — Security practices, threat model, anti-fraud measures
- [Deployment](docs/DEPLOYMENT.md) — Production deployment, infrastructure, backup & recovery
- [Database](docs/DATABASE.md) — Schema, migrations, indexes, queries, maintenance
- [Environment Variables](docs/ENV-REFERENCE.md) — Complete env var reference for all services
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Common issues, error diagnosis, solutions
- [Testing](docs/TESTING.md) — Test strategy, fixtures, scenarios, CI/CD integration
- [Operations](docs/OPERATIONS.md) — Monitoring, runbooks, incident management, on-call
- [Contributing](CONTRIBUTING.md) — Development guidelines, code standards, PR process

## License

This project is proprietary software. All rights reserved.
