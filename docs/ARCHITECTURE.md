# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────┐  │
│  │ wagmi/  │  │ RainbowKit│  │ tweetnacl │  │ Zustand Store  │  │
│  │ viem    │  │ Wallet UI │  │ E2E Crypto│  │ State Mgmt     │  │
│  └────┬────┘  └─────┬────┘  └─────┬─────┘  └───────┬────────┘  │
│       │             │             │                 │            │
└───────┼─────────────┼─────────────┼─────────────────┼────────────┘
        │             │             │                 │
   ┌────▼─────────────▼─┐    ┌─────▼─────┐    ┌──────▼──────┐
   │   EVM Blockchain   │    │  REST API  │    │  WebSocket  │
   │   (BSC/ETH/ARB)    │    │  (FastAPI) │    │  (FastAPI)  │
   └────────┬───────────┘    └─────┬──────┘    └──────┬──────┘
            │                      │                  │
   ┌────────▼───────────┐    ┌─────▼──────────────────▼──────┐
   │  Smart Contracts   │    │         BACKEND               │
   │  ┌──────────────┐  │    │  ┌──────────┐  ┌──────────┐  │
   │  │ P2PEscrow    │  │    │  │ FastAPI   │  │ Celery   │  │
   │  │ .sol         │  │    │  │ Routes    │  │ Workers  │  │
   │  └──────────────┘  │    │  └────┬─────┘  └────┬─────┘  │
   │  ┌──────────────┐  │    │       │             │         │
   │  │ Arbitrator   │  │    │  ┌────▼─────────────▼─────┐  │
   │  │ Pool.sol     │  │    │  │     Service Layer      │  │
   │  └──────────────┘  │    │  └────┬──────────────┬────┘  │
   └────────────────────┘    │       │              │        │
                             │  ┌────▼────┐   ┌────▼────┐   │
                             │  │PostgreSQL│   │  Redis  │   │
                             │  └─────────┘   └─────────┘   │
                             └───────────────────────────────┘
                                        │
                                  ┌─────▼─────┐
                                  │   IPFS    │
                                  │ (Pinata)  │
                                  └───────────┘
```

## Component Architecture

### Smart Contracts

Two primary contracts deployed on each supported chain:

#### P2PEscrow.sol
Core escrow contract handling order lifecycle:

```
createOrder() ──> [Created] ──> sellerConfirmDelivery() ──> [SellerConfirmed]
                      │                                          │
                      │ cancelOrder()              buyerConfirmReceived()
                      ▼                                          │
                 [Cancelled]                               [Completed]
                                                               │
                      ┌────────── openDispute() ◄──────────────┘
                      ▼                (from Created or SellerConfirmed)
                 [Disputed]
                      │
            resolveDispute()
                 ┌────┴────┐
                 ▼         ▼
          [ResolvedBuyer] [ResolvedSeller]

Auto-timeouts:
  [Created] ──24h──> [Expired] (seller didn't confirm)
  [SellerConfirmed] ──72h──> [Completed] (buyer didn't respond, auto-release)
```

#### ArbitratorPool.sol
Manages the arbitrator staking and selection system:
- Arbitrators stake minimum 500 USDT to register
- Weighted random selection based on reputation score (0-100, starting at 50)
- Reputation adjusted after each resolution based on outcome consistency
- Conflict-of-interest checks prevent assignment to related parties

### Backend (FastAPI)

```
app/
├── main.py                 # FastAPI app initialization
├── api/
│   ├── auth.py             # Wallet signature auth (nonce → sign → JWT)
│   ├── products.py         # Product CRUD (encrypted listings)
│   ├── orders.py           # Order management
│   ├── disputes.py         # Dispute handling
│   ├── messages.py         # E2E encrypted message relay
│   └── websocket.py        # Real-time order events
├── models/
│   ├── product.py          # Product SQLAlchemy model
│   ├── order.py            # Order model
│   ├── message.py          # Message model (ciphertext only)
│   ├── dispute.py          # Dispute evidence model
│   ├── arbitrator.py       # Arbitrator model
│   ├── user.py             # User profile model
│   └── review.py           # Review model
├── schemas/
│   ├── auth.py             # Auth request/response schemas
│   ├── product.py          # Product schemas
│   ├── order.py            # Order schemas
│   └── ...
├── services/
│   ├── auth_service.py     # Nonce generation, signature verification
│   ├── order_service.py    # Order business logic
│   ├── blockchain.py       # web3.py contract interaction
│   ├── encryption.py       # Server-side encryption utilities
│   └── ipfs.py             # IPFS upload/download via Pinata
├── core/
│   ├── config.py           # Environment config
│   ├── security.py         # JWT, rate limiting
│   ├── database.py         # DB session management
│   └── dependencies.py     # FastAPI dependencies
└── workers/
    ├── event_listener.py   # Listen blockchain events via web3.py
    ├── timeout_checker.py  # Check & auto-expire/release orders
    └── notifications.py    # Push WebSocket notifications
```

#### Authentication Flow

```
Client                          Server                      Blockchain
  │                               │                              │
  │  POST /auth/nonce             │                              │
  │  { wallet_address }           │                              │
  │──────────────────────────────>│                              │
  │                               │  Generate random nonce       │
  │  { nonce, message }           │  Store nonce (Redis, 5min)   │
  │<──────────────────────────────│                              │
  │                               │                              │
  │  Sign message with wallet     │                              │
  │  ─────────────────────────>   │                              │
  │                               │                              │
  │  POST /auth/verify            │                              │
  │  { wallet, signature, pubkey }│                              │
  │──────────────────────────────>│                              │
  │                               │  Recover signer address      │
  │                               │  Verify nonce exists         │
  │                               │  Store pubkey in DB          │
  │  { jwt_token }                │  Issue JWT (24h expiry)      │
  │<──────────────────────────────│                              │
```

#### Event Synchronization

The backend listens to on-chain events via Celery workers to keep the database in sync:

```
Blockchain                    Celery Worker                  Database
  │                               │                              │
  │  OrderCreated event           │                              │
  │──────────────────────────────>│  Parse event data            │
  │                               │──────────────────────────────>│
  │                               │  Insert/update order         │
  │                               │                              │
  │  OrderCompleted event         │                              │
  │──────────────────────────────>│  Update order status         │
  │                               │──────────────────────────────>│
  │                               │  Notify via WebSocket        │
  │                               │                              │
  │  DisputeOpened event          │                              │
  │──────────────────────────────>│  Assign arbitrator           │
  │                               │──────────────────────────────>│
  │                               │  Notify all parties          │
```

### Frontend (Next.js)

```
src/
├── app/                          # App Router
│   ├── layout.tsx                # Root layout + providers
│   ├── page.tsx                  # Landing page (Server Component)
│   ├── marketplace/
│   │   └── page.tsx              # Browse products
│   ├── product/[id]/
│   │   └── page.tsx              # Product detail + buy
│   ├── sell/
│   │   └── page.tsx              # List product form
│   ├── dashboard/
│   │   ├── layout.tsx            # Dashboard layout (auth guard)
│   │   ├── page.tsx              # Overview
│   │   ├── orders/
│   │   │   ├── page.tsx          # My orders list
│   │   │   └── [id]/page.tsx     # Order detail + chat + actions
│   │   ├── products/page.tsx     # My listed products
│   │   ├── disputes/page.tsx     # My disputes
│   │   └── earnings/page.tsx     # Earnings history
│   ├── arbitrator/
│   │   ├── page.tsx              # Arbitrator dashboard
│   │   └── case/[id]/page.tsx    # Case review + resolve
│   └── profile/[wallet]/
│       └── page.tsx              # Public profile
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── wallet/                   # Wallet connect, balance display
│   ├── product/                  # Product card, list, form
│   ├── order/                    # Order status, actions, timeline
│   ├── chat/                     # E2E encrypted chat
│   └── dispute/                  # Dispute UI, evidence upload
├── hooks/
│   ├── useEscrowContract.ts      # Read/write escrow contract
│   ├── useArbitratorPool.ts      # Arbitrator contract interaction
│   ├── useEncryption.ts          # NaCl key management, encrypt/decrypt
│   ├── useAuth.ts                # Wallet auth + JWT management
│   └── useWebSocket.ts           # Real-time order updates
├── lib/
│   ├── contracts.ts              # Contract ABIs and addresses
│   ├── encryption.ts             # tweetnacl wrapper utilities
│   ├── api.ts                    # API client (fetch + JWT)
│   └── config.ts                 # Chain config, supported tokens
└── stores/
    ├── authStore.ts              # Auth state (wallet, JWT, keys)
    ├── orderStore.ts             # Active orders
    └── notificationStore.ts      # Real-time notifications
```

## Data Flow Diagrams

### Happy Path: Purchase Flow

```
 Buyer                Frontend              Backend             Contract            Seller
  │                     │                     │                    │                   │
  │  Click "Buy"        │                     │                    │                   │
  │────────────────────>│                     │                    │                   │
  │                     │  approve(USDT)      │                    │                   │
  │  Confirm TX in      │───────────────────────────────────────>│                   │
  │  wallet             │                     │                    │                   │
  │                     │  createOrder()      │                    │                   │
  │                     │───────────────────────────────────────>│                   │
  │                     │                     │                    │                   │
  │                     │                     │  OrderCreated      │                   │
  │                     │                     │  event             │                   │
  │                     │                     │<───────────────────│                   │
  │                     │                     │                    │                   │
  │                     │                     │  POST /orders      │                   │
  │                     │                     │  (sync to DB)      │                   │
  │                     │                     │                    │                   │
  │                     │                     │  WebSocket notify  │                   │
  │                     │                     │──────────────────────────────────────>│
  │                     │                     │                    │                   │
  │                     │                     │                    │  sellerConfirm    │
  │                     │                     │                    │  Delivery()       │
  │                     │                     │                    │<──────────────────│
  │                     │                     │                    │                   │
  │                     │                     │  SellerConfirmed   │                   │
  │  WebSocket:         │                     │  event             │                   │
  │  "Seller shipped"   │                     │<───────────────────│                   │
  │<────────────────────│<────────────────────│                    │                   │
  │                     │                     │                    │                   │
  │  Decrypt & verify   │                     │                    │                   │
  │  product            │                     │                    │                   │
  │                     │  buyerConfirm       │                    │                   │
  │                     │  Received()         │                    │                   │
  │                     │───────────────────────────────────────>│                   │
  │                     │                     │                    │  Release funds    │
  │                     │                     │                    │──────────────────>│
  │                     │                     │                    │                   │
  │                     │                     │  OrderCompleted    │                   │
  │                     │                     │  event             │                   │
  │                     │                     │<───────────────────│                   │
```

### Dispute Flow

```
 Party              Frontend              Backend             Contract           Arbitrator
  │                    │                     │                    │                   │
  │  Open Dispute      │                     │                    │                   │
  │───────────────────>│                     │                    │                   │
  │                    │  Upload evidence    │                    │                   │
  │                    │  to IPFS (encrypt)  │                    │                   │
  │                    │────────────────────>│                    │                   │
  │                    │                     │  Pin to IPFS       │                   │
  │                    │                     │────────>           │                   │
  │                    │                     │                    │                   │
  │                    │  openDispute()      │                    │                   │
  │                    │───────────────────────────────────────>│                   │
  │                    │                     │                    │                   │
  │                    │                     │  DisputeOpened     │                   │
  │                    │                     │  event             │                   │
  │                    │                     │<───────────────────│                   │
  │                    │                     │                    │                   │
  │                    │                     │  Assign arbitrator │                   │
  │                    │                     │  (weighted random) │                   │
  │                    │                     │                    │                   │
  │                    │                     │  WebSocket notify  │                   │
  │                    │                     │──────────────────────────────────────>│
  │                    │                     │                    │                   │
  │                    │                     │                    │   Review evidence │
  │                    │                     │                    │   (decrypt)       │
  │                    │                     │                    │                   │
  │                    │                     │                    │  resolveDispute() │
  │                    │                     │                    │<──────────────────│
  │                    │                     │                    │                   │
  │                    │                     │  DisputeResolved   │   Receive 5%     │
  │  Receive funds     │                     │  event             │   arb fee        │
  │  (if won)          │                     │<───────────────────│──────────────────>│
  │<───────────────────│<────────────────────│                    │                   │
```

## Database Entity Relationships

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ user_profiles│     │   products   │     │  arbitrators │
│──────────────│     │──────────────│     │──────────────│
│ wallet (PK)  │<──┐ │ id (PK)     │  ┌─>│ wallet (PK)  │
│ display_name │   │ │ seller_wallet│──┘  │ stake_amount │
│ public_key   │   │ │ title       │     │ reputation   │
│ total_trades │   │ │ price_usdt  │     │ is_active    │
│ rating       │   │ │ stock       │     └──────────────┘
└──────────────┘   │ │ product_hash│
                   │ └──────┬───────┘
                   │        │
                   │ ┌──────▼───────┐     ┌──────────────────┐
                   │ │    orders    │     │ dispute_evidence  │
                   │ │──────────────│     │──────────────────│
                   ├─│ buyer_wallet │     │ id (PK)          │
                   ├─│ seller_wallet│  ┌──│ order_id (FK)    │
                   │ │ arbitrator   │──┘  │ submitter_wallet │
                   │ │ product_id   │     │ ipfs_hash        │
                   │ │ amount       │     └──────────────────┘
                   │ │ status       │
                   │ └──────┬───────┘
                   │        │
                   │ ┌──────▼───────┐     ┌──────────────┐
                   │ │   messages   │     │   reviews    │
                   │ │──────────────│     │──────────────│
                   │ │ id (PK)     │     │ id (PK)      │
                   └─│ sender_wallet│     │ order_id(FK) │
                     │ order_id(FK)│     │ reviewer     │
                     │ ciphertext  │     │ target       │
                     │ nonce       │     │ rating (1-5) │
                     └─────────────┘     └──────────────┘
```

## Multi-Chain Strategy

The platform supports deployment on multiple EVM-compatible chains:

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│          (chain-agnostic via wagmi)              │
└──────────┬──────────┬──────────┬────────────────┘
           │          │          │
    ┌──────▼──┐  ┌────▼────┐  ┌─▼──────────┐
    │  BSC    │  │  ETH    │  │  Arbitrum   │
    │ Escrow  │  │ Escrow  │  │  Escrow     │
    │ + Pool  │  │ + Pool  │  │  + Pool     │
    └─────────┘  └─────────┘  └────────────┘
```

Each chain has independent contract deployments with chain-specific configuration:
- **Block confirmations**: BSC (15), ETH (12), Arbitrum (1)
- **Gas optimization**: Tuned per chain
- **Token addresses**: Chain-specific USDT/USDC addresses

The backend maintains a unified view across all chains with `chain` field on orders.

## Caching Strategy

```
Redis
├── auth:nonce:{wallet}          # Auth nonces (TTL: 5 min)
├── session:{jwt_id}             # Active sessions (TTL: 24h)
├── rate:{wallet}:{endpoint}     # Rate limiting counters (TTL: 1 min)
├── product:list:{page}:{filter} # Product listing cache (TTL: 30s)
├── user:profile:{wallet}        # User profile cache (TTL: 5 min)
├── ws:channel:{order_id}        # WebSocket pub/sub channels
└── arb:pool:active              # Active arbitrator pool (TTL: 1 min)
```

## Scalability Considerations

- **Database**: Read replicas for marketplace browsing, write primary for transactions
- **WebSocket**: Redis pub/sub allows horizontal scaling of WebSocket servers
- **Event Processing**: Celery workers scale independently per chain
- **IPFS**: Pinata handles pinning; client-side encryption before upload
- **Frontend**: Static generation for public pages, ISR for product listings
