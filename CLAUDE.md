# CLAUDE.md

## Project Overview

P2P Escrow Privacy Marketplace — a decentralized, non-custodial marketplace for digital products with smart contract escrow, E2E encryption, and on-chain dispute resolution.

## Tech Stack

- **Contracts**: Solidity ^0.8.20, OpenZeppelin, Foundry
- **Backend**: Python 3.11+, FastAPI, PostgreSQL 15+, Redis 7+, Celery, web3.py, PyNaCl
- **Frontend**: Next.js 14+ (App Router), TypeScript strict, wagmi v2, viem, RainbowKit, shadcn/ui, TailwindCSS, tweetnacl-js, Zustand

## Chain Priority

- **BNB Smart Chain (BSC)** — Primary and only chain for MVP. All development, testing, and deployment targets BSC first.
- Ethereum, Arbitrum, Base — Deferred to post-MVP. Multi-chain support is architecturally prepared but not implemented until BSC is fully live.

## Key Documentation

All design decisions are documented in `docs/`. Read these before implementing:

- `docs/ARCHITECTURE.md` — System design, component structure, data flows
- `docs/API.md` — All endpoints, request/response schemas, error codes
- `docs/SMART-CONTRACT.md` — Contract interfaces, events, state machine
- `docs/ENCRYPTION.md` — 4-layer encryption scheme, key derivation
- `docs/DATABASE.md` — Full schema DDL, indexes, enums, constraints
- `docs/SECURITY.md` — Security practices, anti-fraud, rate limiting
- `docs/ENV-REFERENCE.md` — All environment variables
- `docs/TESTING.md` — Test strategy, fixtures, CI/CD

## Conventions

- **Commits**: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`)
- **Branches**: `feature/xxx`, `fix/xxx`, `refactor/xxx` from `develop`
- **Solidity**: NatSpec on public functions, events for every state change
- **Python**: Type hints, async/await, Pydantic schemas, PEP 8 (ruff)
- **TypeScript**: strict mode, no `any`, PascalCase components, camelCase functions
- **Testing**: Contracts >= 95% coverage, Backend >= 85%, Frontend >= 75%

## Progress Tracking

After completing each task, update `Progress.md` with:
- What was done
- Files created/modified
- Any decisions made or deviations from the plan

---

## Implementation Plan

### Phase 1: Smart Contracts (Foundry)

The foundation. Everything depends on the contract interfaces and events.

#### 1.1 Project Setup
- [ ] Initialize Foundry project in `contracts/`
- [ ] Install OpenZeppelin via `forge install`
- [ ] Configure `foundry.toml` (solc 0.8.20, optimizer, remappings)
- [ ] Create `.env.example` for deployment keys

#### 1.2 Interfaces
- [ ] `src/interfaces/IP2PEscrow.sol` — Escrow interface with all function signatures and events
- [ ] `src/interfaces/IArbitratorPool.sol` — Arbitrator pool interface

#### 1.3 ArbitratorPool.sol
- [ ] Arbitrator struct, state variables
- [ ] `register()` — Stake tokens to become arbitrator
- [ ] `increaseStake()` — Add to existing stake
- [ ] `withdraw()` — Withdraw stake and deactivate
- [ ] `selectArbitrator()` — Weighted random selection with conflict-of-interest check
- [ ] `updateReputation()` — Adjust reputation after dispute resolution
- [ ] Events: ArbitratorRegistered, ArbitratorWithdrawn, ReputationUpdated

#### 1.4 P2PEscrow.sol
- [ ] Order struct, OrderStatus enum, state variables, constants
- [ ] `createOrder()` — Lock buyer funds in escrow
- [ ] `sellerConfirmDelivery()` — Seller confirms delivery
- [ ] `buyerConfirmReceived()` — Release funds to seller + fee to treasury
- [ ] `cancelOrder()` — Buyer cancels before seller confirms
- [ ] `openDispute()` — Either party opens dispute, assigns arbitrator
- [ ] `submitEvidence()` — Submit IPFS evidence hash
- [ ] `resolveDispute()` — Arbitrator resolves, distributes funds
- [ ] `autoExpireOrder()` — 24h seller timeout auto-refund
- [ ] `autoReleaseToSeller()` — 72h buyer timeout auto-release
- [ ] Admin: `setSupportedToken()`, `setTreasury()`, `setArbitratorPool()`, `pause()`/`unpause()`
- [ ] Events: OrderCreated, SellerConfirmed, OrderCompleted, OrderCancelled, OrderExpired, DisputeOpened, EvidenceSubmitted, DisputeResolved

#### 1.5 Deploy Scripts
- [ ] `script/Deploy.s.sol` — Deploy both contracts to BSC, configure USDT/USDC and treasury

#### 1.6 Tests
- [ ] `test/helpers/BaseTest.sol` — Shared setup, test wallets, MockERC20
- [ ] `test/helpers/MockERC20.sol` — Mock USDT/USDC
- [ ] `test/P2PEscrow.t.sol` — Unit tests for every function + revert cases
- [ ] `test/ArbitratorPool.t.sol` — Unit tests for staking, selection, reputation
- [ ] `test/P2PEscrow.fuzz.t.sol` — Fuzz tests for amounts, edge cases
- [ ] `test/integration/FullFlow.t.sol` — Happy path, dispute flow, timeout flows
- [ ] Coverage >= 95%

---

### Phase 2: Backend (FastAPI)

API server, database, blockchain sync, and background workers.

#### 2.1 Project Setup
- [ ] Initialize project in `backend/`
- [ ] `requirements.txt` — FastAPI, uvicorn, SQLAlchemy, asyncpg, alembic, redis, celery, web3, pynacl, pydantic-settings, python-jose, ruff
- [ ] `requirements-dev.txt` — pytest, pytest-asyncio, httpx, fakeredis, coverage, ruff
- [ ] `app/core/config.py` — Pydantic Settings from env vars (BSC RPC, contract addresses)
- [ ] `app/core/database.py` — Async engine, session factory, `get_db` dependency
- [ ] `app/core/security.py` — JWT encode/decode, rate limiting middleware
- [ ] `app/core/dependencies.py` — `get_current_user`, `require_auth`
- [ ] `app/main.py` — FastAPI app, CORS, middleware, router includes
- [ ] `.env.example` — Template with all variables
- [ ] Alembic init + `alembic.ini` config

#### 2.2 Database Models
- [ ] `app/models/base.py` — Base declarative model
- [ ] `app/models/user.py` — UserProfile (wallet PK, public_key, reputation, tier)
- [ ] `app/models/product.py` — Product (UUID PK, seller FK, category, price, status)
- [ ] `app/models/order.py` — Order (UUID PK, onchain_order_id, buyer/seller, status) — BSC only
- [ ] `app/models/message.py` — Message (ciphertext + nonce only)
- [ ] `app/models/review.py` — Review (rating 1-5, unique per order+reviewer)
- [ ] `app/models/arbitrator.py` — Arbitrator (wallet PK, stake, reputation)
- [ ] `app/models/dispute.py` — DisputeEvidence (IPFS hash, evidence_type)
- [ ] `app/models/blacklist.py` — Blacklist (wallet, reason, source)
- [ ] `app/models/event_sync.py` — EventSyncCursor (last_block for BSC)
- [ ] Initial Alembic migration with all tables, indexes, enums (from DATABASE.md)

#### 2.3 Pydantic Schemas
- [ ] `app/schemas/auth.py` — NonceRequest, NonceResponse, VerifyRequest, TokenResponse
- [ ] `app/schemas/product.py` — ProductCreate, ProductUpdate, ProductResponse, ProductList
- [ ] `app/schemas/order.py` — OrderCreate, OrderResponse, OrderList, DeliverRequest, ConfirmRequest
- [ ] `app/schemas/dispute.py` — DisputeCreate, EvidenceSubmit, ResolveRequest
- [ ] `app/schemas/message.py` — MessageCreate, MessageResponse
- [ ] `app/schemas/common.py` — APIResponse wrapper, PaginatedResponse, ErrorResponse

#### 2.4 Services
- [ ] `app/services/auth_service.py` — Nonce generation (Redis), wallet signature verification (eth_account), JWT issue
- [ ] `app/services/product_service.py` — CRUD, search, pagination, blacklist check
- [ ] `app/services/order_service.py` — Create (verify on-chain TX), status sync, deliver, confirm, cancel
- [ ] `app/services/dispute_service.py` — Open dispute, submit evidence, resolve
- [ ] `app/services/message_service.py` — Store/retrieve encrypted messages
- [ ] `app/services/review_service.py` — Create review, recalculate rating
- [ ] `app/services/reputation_service.py` — Calculate reputation score, determine tier
- [ ] `app/services/blockchain_service.py` — web3.py wrapper: verify TX, read contract state, call auto-expire/release
- [ ] `app/services/ipfs_service.py` — Pinata upload/download

#### 2.5 API Routes
- [ ] `app/api/health.py` — GET /health (DB, Redis, Celery, RPC checks)
- [ ] `app/api/auth.py` — POST /auth/nonce, POST /auth/verify
- [ ] `app/api/products.py` — GET /products, GET /products/:id, POST /products, PUT /products/:id, DELETE /products/:id
- [ ] `app/api/orders.py` — POST /orders, GET /orders, GET /orders/:id, POST /orders/:id/deliver, POST /orders/:id/confirm, POST /orders/:id/cancel, POST /orders/:id/dispute
- [ ] `app/api/disputes.py` — POST /disputes/:id/evidence, POST /disputes/:id/resolve
- [ ] `app/api/messages.py` — GET /orders/:id/messages, POST /orders/:id/messages
- [ ] `app/api/websocket.py` — WS /ws/orders/:id (JWT auth, Redis pub/sub)

#### 2.6 Celery Workers
- [ ] `app/workers/__init__.py` — Celery app, config, beat schedule
- [ ] `app/workers/event_listener.py` — Poll BSC blockchain events, sync to DB
- [ ] `app/workers/timeout_checker.py` — Scan for expired orders, call on-chain auto-expire/release
- [ ] `app/workers/notifications.py` — Publish WebSocket events via Redis pub/sub
- [ ] `app/workers/maintenance.py` — Cleanup nonces, recalculate tiers, purge old data

#### 2.7 Backend Tests
- [ ] `tests/conftest.py` — DB fixtures, test client, auth helpers
- [ ] `tests/factories.py` — Test data factories
- [ ] `tests/unit/` — Service layer unit tests
- [ ] `tests/integration/` — API endpoint integration tests
- [ ] `tests/workers/` — Celery worker tests
- [ ] Coverage >= 85%

---

### Phase 3: Frontend (Next.js)

User-facing application with wallet integration and E2E encryption.

#### 3.1 Project Setup
- [ ] Initialize Next.js 14+ with App Router in `frontend/`
- [ ] Install and configure: wagmi v2, viem, @rainbow-me/rainbowkit, tailwindcss, shadcn/ui, tweetnacl, zustand
- [ ] `src/lib/config.ts` — BSC chain config, supported tokens (USDT, USDC)
- [ ] `src/lib/contracts.ts` — Contract ABIs + BSC addresses (from deploy output)
- [ ] `src/lib/api.ts` — API client (fetch wrapper with JWT injection, error handling)
- [ ] `src/lib/encryption.ts` — tweetnacl wrapper (encryptMessage, decryptMessage, encryptProductKey, decryptProductKey, encryptEvidence)
- [ ] `.env.example` — Template with all NEXT_PUBLIC_ variables
- [ ] `tailwind.config.ts` + shadcn/ui setup

#### 3.2 Providers & Layout
- [ ] `src/app/layout.tsx` — Root layout with Providers wrapper
- [ ] `src/app/providers.tsx` — WagmiProvider, RainbowKitProvider, QueryClientProvider
- [ ] Auth guard component for protected routes

#### 3.3 Zustand Stores
- [ ] `src/stores/authStore.ts` — Wallet address, JWT, NaCl keypair, isAuthenticated
- [ ] `src/stores/orderStore.ts` — Active orders, order detail cache
- [ ] `src/stores/notificationStore.ts` — Real-time notifications queue

#### 3.4 Custom Hooks
- [ ] `src/hooks/useAuth.ts` — Connect wallet → request nonce → sign → verify → store JWT + derive NaCl keypair
- [ ] `src/hooks/useEncryption.ts` — Key management, encrypt/decrypt with NaCl keypair
- [ ] `src/hooks/useEscrowContract.ts` — Read/write P2PEscrow (createOrder, confirm, cancel, dispute)
- [ ] `src/hooks/useArbitratorPool.ts` — Read/write ArbitratorPool (register, resolve)
- [ ] `src/hooks/useWebSocket.ts` — Connect to WS, handle events, reconnect logic

#### 3.5 Shared Components
- [ ] `src/components/ui/` — shadcn/ui base components (Button, Card, Input, Dialog, Table, Badge, etc.)
- [ ] `src/components/wallet/ConnectButton.tsx` — RainbowKit connect + display address
- [ ] `src/components/wallet/BalanceDisplay.tsx` — USDT/USDC balance on BSC
- [ ] `src/components/layout/Header.tsx` — Nav, wallet connect, notifications
- [ ] `src/components/layout/Footer.tsx`

#### 3.6 Pages — Public
- [ ] `src/app/page.tsx` — Landing page (hero, how it works, stats)
- [ ] `src/app/marketplace/page.tsx` — Browse products (search, filter, sort, pagination)
- [ ] `src/app/product/[id]/page.tsx` — Product detail + buy button + seller info
- [ ] `src/app/profile/[wallet]/page.tsx` — Public profile (reputation, reviews, listed products)

#### 3.7 Pages — Dashboard (Auth Required)
- [ ] `src/app/dashboard/layout.tsx` — Dashboard layout + sidebar + auth guard
- [ ] `src/app/dashboard/page.tsx` — Overview (active orders, earnings summary)
- [ ] `src/app/dashboard/orders/page.tsx` — My orders list (as buyer + seller, filter by status)
- [ ] `src/app/dashboard/orders/[id]/page.tsx` — Order detail + encrypted chat + action buttons (confirm/cancel/dispute)
- [ ] `src/app/dashboard/products/page.tsx` — My listed products + create/edit
- [ ] `src/app/dashboard/disputes/page.tsx` — My disputes
- [ ] `src/app/dashboard/earnings/page.tsx` — Earnings history + charts

#### 3.8 Pages — Sell
- [ ] `src/app/sell/page.tsx` — Create product listing form (title, description, category, price, stock, upload encrypted product)

#### 3.9 Pages — Arbitrator
- [ ] `src/app/arbitrator/page.tsx` — Arbitrator dashboard (register, active cases, earnings, reputation)
- [ ] `src/app/arbitrator/case/[id]/page.tsx` — Case review (decrypt evidence, resolve dispute)

#### 3.10 Product Components
- [ ] `src/components/product/ProductCard.tsx` — Card for marketplace grid
- [ ] `src/components/product/ProductList.tsx` — Grid/list with pagination
- [ ] `src/components/product/ProductForm.tsx` — Create/edit form
- [ ] `src/components/product/ProductFilters.tsx` — Search, category, price range, sort

#### 3.11 Order Components
- [ ] `src/components/order/OrderCard.tsx` — Order summary card
- [ ] `src/components/order/OrderTimeline.tsx` — Status timeline with timestamps
- [ ] `src/components/order/OrderActions.tsx` — Contextual action buttons (confirm, cancel, dispute)
- [ ] `src/components/order/BuyFlow.tsx` — Multi-step: approve → create order → wait

#### 3.12 Chat & Dispute Components
- [ ] `src/components/chat/ChatWindow.tsx` — E2E encrypted chat within order
- [ ] `src/components/chat/MessageBubble.tsx` — Decrypt + display message
- [ ] `src/components/chat/ChatInput.tsx` — Compose + encrypt + send
- [ ] `src/components/dispute/DisputeForm.tsx` — Open dispute + upload evidence
- [ ] `src/components/dispute/EvidenceViewer.tsx` — Decrypt + display IPFS evidence
- [ ] `src/components/dispute/ResolvePanel.tsx` — Arbitrator resolve UI

#### 3.13 Frontend Tests
- [ ] Component tests (vitest + testing-library)
- [ ] Hook tests (encryption, auth)
- [ ] Encryption utility tests (round-trip, wrong key, unicode)
- [ ] E2E tests with Playwright (marketplace browse, wallet connect)
- [ ] Coverage >= 75%

---

### Phase 4: Integration & Polish

#### 4.1 Full Stack Integration
- [ ] Docker Compose for local development (all services)
- [ ] End-to-end flow test on local Anvil fork
- [ ] Verify: create order → seller confirm → buyer confirm → funds released
- [ ] Verify: dispute flow → evidence → arbitrator resolve
- [ ] Verify: timeout auto-expire and auto-release
- [ ] Verify: E2E encrypted messaging round-trip
- [ ] WebSocket real-time notifications working

#### 4.2 BSC Testnet Deployment
- [ ] Deploy contracts to BSC Testnet (Chapel)
- [ ] Deploy backend to staging server (BSC RPC)
- [ ] Deploy frontend to Vercel (staging)
- [ ] Full E2E test on BSC Testnet with real wallets

#### 4.3 Security Hardening
- [ ] Smart contract audit checklist (SECURITY.md)
- [ ] Backend security headers verified
- [ ] Rate limiting tested
- [ ] CORS locked down
- [ ] Input validation on all endpoints
- [ ] No secrets in code or logs

#### 4.4 CI/CD
- [ ] GitHub Actions: contracts (forge test + coverage)
- [ ] GitHub Actions: backend (pytest + ruff + coverage)
- [ ] GitHub Actions: frontend (vitest + lint + type-check)
- [ ] E2E pipeline on PRs to main

---

### Phase 5: Production

#### 5.1 Infrastructure
- [ ] Production server setup (DEPLOYMENT.md)
- [ ] PostgreSQL + Redis production config
- [ ] Nginx + SSL (Let's Encrypt or Cloudflare)
- [ ] Monitoring stack (Prometheus + Grafana or UptimeRobot)

#### 5.2 BSC Mainnet Deploy
- [ ] Smart contract mainnet deployment (BSC)
- [ ] Contract verification on BscScan
- [ ] Configure USDT/USDC token addresses + treasury (multisig)
- [ ] Backend production deployment (BSC RPC)
- [ ] Frontend production deployment
- [ ] Post-deployment verification checklist (DEPLOYMENT.md)

#### 5.3 Go Live (BSC)
- [ ] Seed initial arbitrators on BSC
- [ ] Monitor first transactions
- [ ] Watch dispute rate and system health
- [ ] Operations runbooks ready (OPERATIONS.md)

---

### Future: Multi-Chain Expansion

After BSC is stable and live, expand to other chains:
- [ ] Ethereum — USDT/USDC support
- [ ] Arbitrum — USDT/USDC support
- [ ] Base — USDC support
- [ ] Add chain selector to frontend
- [ ] Backend multi-chain event listener
- [ ] Cross-chain order tracking
