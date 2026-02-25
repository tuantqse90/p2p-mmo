# Testing Guide

Testing strategy, tools, fixtures, and test scenarios for P2P Escrow Privacy Marketplace.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Coverage Targets](#coverage-targets)
- [1. Smart Contract Tests (Foundry)](#1-smart-contract-tests-foundry)
  - [Running Tests](#running-tests)
  - [Test Structure](#test-structure)
  - [Unit Tests](#unit-tests)
  - [Fuzz Tests](#fuzz-tests)
  - [Integration Tests](#integration-tests)
  - [Gas Benchmarks](#gas-benchmarks)
- [2. Backend Tests (pytest)](#2-backend-tests-pytest)
  - [Running Tests](#running-tests-1)
  - [Test Structure](#test-structure-1)
  - [Fixtures](#fixtures)
  - [API Endpoint Tests](#api-endpoint-tests)
  - [Service Layer Tests](#service-layer-tests)
  - [Worker Tests](#worker-tests)
  - [WebSocket Tests](#websocket-tests)
  - [Mocking External Services](#mocking-external-services)
- [3. Frontend Tests](#3-frontend-tests)
  - [Running Tests](#running-tests-2)
  - [Test Structure](#test-structure-2)
  - [Component Tests](#component-tests)
  - [Hook Tests](#hook-tests)
  - [Encryption Tests](#encryption-tests)
  - [E2E Tests (Playwright)](#e2e-tests-playwright)
- [4. Test Scenarios](#4-test-scenarios)
  - [Happy Path: Purchase Flow](#happy-path-purchase-flow)
  - [Dispute Flow](#dispute-flow)
  - [Timeout & Auto-Expiry](#timeout--auto-expiry)
  - [Encryption Round-Trip](#encryption-round-trip)
  - [Edge Cases](#edge-cases)
- [5. Test Data & Fixtures](#5-test-data--fixtures)
  - [Wallet Fixtures](#wallet-fixtures)
  - [Database Seed Data](#database-seed-data)
  - [Mock Contract State](#mock-contract-state)
- [6. CI/CD Integration](#6-cicd-integration)
- [7. Performance Testing](#7-performance-testing)
- [8. Security Testing](#8-security-testing)

---

## Testing Philosophy

```
                    ┌──────────┐
                    │   E2E    │     Few, slow, high confidence
                    ├──────────┤
                  │ Integration │    Moderate count, moderate speed
                  ├──────────────┤
                │    Unit Tests    │  Many, fast, isolated
                └──────────────────┘
```

- **Unit tests** verify individual functions in isolation. Mock all external dependencies.
- **Integration tests** verify component interaction (API → service → DB, contract → events).
- **E2E tests** verify complete user flows through the full stack.
- **Fuzz tests** (contracts only) discover edge cases by generating random inputs.

**Principles:**

- Tests must be deterministic — no flaky tests, no dependence on external state.
- Each test should test one thing and have a descriptive name.
- Prefer testing behavior over implementation details.
- Smart contract tests are the most critical — bugs are irreversible once deployed.

---

## Coverage Targets

| Layer | Target | Tool | Enforcement |
|-------|--------|------|-------------|
| Smart Contracts | >= 95% | `forge coverage` | CI blocks merge below threshold |
| Backend | >= 85% | `pytest --cov` | CI warning below 80%, blocks below 70% |
| Frontend | >= 75% | `vitest --coverage` | CI warning below 70% |
| E2E | Critical flows covered | Playwright | CI runs on PRs to `main` |

---

## 1. Smart Contract Tests (Foundry)

### Running Tests

```bash
cd contracts

# All tests
forge test

# Verbose output (show traces on failure)
forge test -vvvv

# Specific test file
forge test --match-path test/P2PEscrow.t.sol

# Specific test function
forge test --match-test testCreateOrder

# Fuzz tests only
forge test --match-test testFuzz

# Gas report
forge test --gas-report

# Coverage report
forge coverage
forge coverage --report lcov    # Generate lcov for CI
```

### Test Structure

```
contracts/test/
├── P2PEscrow.t.sol              # Escrow unit + integration tests
├── ArbitratorPool.t.sol         # Arbitrator pool tests
├── P2PEscrow.fuzz.t.sol         # Fuzz tests for escrow
├── helpers/
│   ├── BaseTest.sol             # Shared setup, utilities, test wallets
│   ├── MockERC20.sol            # Mock USDT/USDC token
│   └── MockArbitratorPool.sol   # Mock arbitrator pool for isolated escrow tests
└── integration/
    └── FullFlow.t.sol           # End-to-end flow tests
```

### Unit Tests

Each contract function should have tests covering: success path, all revert conditions, event emissions, and state changes.

**Example — P2PEscrow.t.sol:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/P2PEscrow.sol";
import "./helpers/MockERC20.sol";
import "./helpers/MockArbitratorPool.sol";

contract P2PEscrowTest is Test {
    P2PEscrow escrow;
    MockERC20 usdt;
    MockArbitratorPool arbPool;

    address buyer  = makeAddr("buyer");
    address seller = makeAddr("seller");
    address treasury = makeAddr("treasury");
    address arbitrator = makeAddr("arbitrator");

    uint256 constant PRICE = 100e6;         // 100 USDT
    uint256 constant PLATFORM_FEE = 2e6;    // 2 USDT (2%)
    bytes32 constant PRODUCT_HASH = keccak256("test-product");

    function setUp() public {
        usdt = new MockERC20("USDT", "USDT", 6);
        arbPool = new MockArbitratorPool(arbitrator);

        escrow = new P2PEscrow();
        escrow.setSupportedToken(address(usdt), true);
        escrow.setTreasury(treasury);
        escrow.setArbitratorPool(address(arbPool));

        // Fund buyer
        usdt.mint(buyer, 10_000e6);
        vm.prank(buyer);
        usdt.approve(address(escrow), type(uint256).max);
    }

    // ── createOrder ────────────────────────────────

    function testCreateOrder_Success() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        assertEq(orderId, 0);

        (,address orderBuyer, address orderSeller,,, uint256 amount,,
         P2PEscrow.OrderStatus status,,,,,) = escrow.orders(orderId);

        assertEq(orderBuyer, buyer);
        assertEq(orderSeller, seller);
        assertEq(amount, PRICE);
        assertEq(uint8(status), uint8(P2PEscrow.OrderStatus.Created));

        // Verify token transfer
        assertEq(usdt.balanceOf(address(escrow)), PRICE + PLATFORM_FEE);
    }

    function testCreateOrder_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit P2PEscrow.OrderCreated(0, buyer, seller, address(usdt), PRICE, PRODUCT_HASH);

        vm.prank(buyer);
        escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);
    }

    function testCreateOrder_RevertsIfUnsupportedToken() public {
        MockERC20 fakeToken = new MockERC20("FAKE", "FAKE", 6);
        vm.prank(buyer);
        vm.expectRevert("Unsupported token");
        escrow.createOrder(seller, address(fakeToken), PRICE, PRODUCT_HASH);
    }

    function testCreateOrder_RevertsIfAmountTooLow() public {
        vm.prank(buyer);
        vm.expectRevert("Amount too low");
        escrow.createOrder(seller, address(usdt), 0.5e6, PRODUCT_HASH);  // 0.5 USDT < 1 USDT min
    }

    function testCreateOrder_RevertsIfBuyerIsSeller() public {
        vm.prank(buyer);
        vm.expectRevert();
        escrow.createOrder(buyer, address(usdt), PRICE, PRODUCT_HASH);
    }

    // ── cancelOrder ────────────────────────────────

    function testCancelOrder_RefundsBuyer() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        uint256 balanceBefore = usdt.balanceOf(buyer);
        vm.prank(buyer);
        escrow.cancelOrder(orderId);

        assertEq(usdt.balanceOf(buyer), balanceBefore + PRICE + PLATFORM_FEE);
    }

    function testCancelOrder_RevertsIfNotBuyer() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        vm.prank(seller);
        vm.expectRevert("Not buyer");
        escrow.cancelOrder(orderId);
    }

    function testCancelOrder_RevertsIfSellerAlreadyConfirmed() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        vm.prank(buyer);
        vm.expectRevert("Invalid status transition");
        escrow.cancelOrder(orderId);
    }

    // ── Happy path ─────────────────────────────────

    function testHappyPath_FullFlow() public {
        // 1. Buyer creates order
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        // 2. Seller confirms delivery
        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        // 3. Buyer confirms receipt
        uint256 sellerBalanceBefore = usdt.balanceOf(seller);
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(buyer);
        escrow.buyerConfirmReceived(orderId);

        // Verify payouts
        assertEq(usdt.balanceOf(seller), sellerBalanceBefore + PRICE);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore + PLATFORM_FEE);
    }

    // ── Timeouts ───────────────────────────────────

    function testAutoExpire_After24h() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        // Fast-forward 24 hours + 1 second
        vm.warp(block.timestamp + 24 hours + 1);

        uint256 buyerBalanceBefore = usdt.balanceOf(buyer);
        escrow.autoExpireOrder(orderId);

        assertEq(usdt.balanceOf(buyer), buyerBalanceBefore + PRICE + PLATFORM_FEE);
    }

    function testAutoRelease_After72h() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        // Fast-forward 72 hours + 1 second
        vm.warp(block.timestamp + 72 hours + 1);

        uint256 sellerBalanceBefore = usdt.balanceOf(seller);
        escrow.autoReleaseToSeller(orderId);

        assertEq(usdt.balanceOf(seller), sellerBalanceBefore + PRICE);
    }
}
```

### Fuzz Tests

Foundry's built-in fuzzer generates random inputs to find edge cases.

**Example — P2PEscrow.fuzz.t.sol:**

```solidity
contract P2PEscrowFuzzTest is P2PEscrowTest {

    function testFuzz_CreateOrder_AnyValidAmount(uint256 amount) public {
        // Bound to valid range: 1 USDT to 1M USDT
        amount = bound(amount, 1e6, 1_000_000e6);

        usdt.mint(buyer, amount + (amount * 200 / 10000));  // amount + 2% fee
        vm.prank(buyer);
        usdt.approve(address(escrow), type(uint256).max);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), amount, PRODUCT_HASH);

        (, , , , , uint256 orderAmount, , , , , , , ) = escrow.orders(orderId);
        assertEq(orderAmount, amount);
    }

    function testFuzz_PlatformFee_AlwaysCorrect(uint256 amount) public {
        amount = bound(amount, 1e6, 1_000_000e6);
        uint256 expectedFee = amount * 200 / 10000;     // 2% in basis points

        usdt.mint(buyer, amount + expectedFee);
        vm.prank(buyer);
        usdt.approve(address(escrow), type(uint256).max);

        vm.prank(buyer);
        escrow.createOrder(seller, address(usdt), amount, PRODUCT_HASH);

        assertEq(usdt.balanceOf(address(escrow)), amount + expectedFee);
    }

    function testFuzz_CannotCreateWithInvalidAmount(uint256 amount) public {
        amount = bound(amount, 0, 1e6 - 1);     // Below minimum

        vm.prank(buyer);
        vm.expectRevert("Amount too low");
        escrow.createOrder(seller, address(usdt), amount, PRODUCT_HASH);
    }
}
```

### Integration Tests

Test multi-step flows involving both contracts.

**Example — FullFlow.t.sol:**

```solidity
contract FullFlowTest is BaseTest {

    function testDisputeFlow_FavorBuyer() public {
        // 1. Create order
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        // 2. Seller confirms
        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        // 3. Buyer opens dispute
        vm.prank(buyer);
        escrow.openDispute(orderId, "QmBuyerEvidence");

        // 4. Seller submits evidence
        vm.prank(seller);
        escrow.submitEvidence(orderId, "QmSellerEvidence");

        // 5. Arbitrator resolves in buyer's favor
        uint256 arbFee = PRICE * 500 / 10000;   // 5%
        uint256 buyerExpected = PRICE - arbFee;

        uint256 buyerBalanceBefore = usdt.balanceOf(buyer);
        uint256 arbBalanceBefore = usdt.balanceOf(arbitrator);

        vm.prank(arbitrator);
        escrow.resolveDispute(orderId, true);

        assertEq(usdt.balanceOf(buyer), buyerBalanceBefore + buyerExpected);
        assertEq(usdt.balanceOf(arbitrator), arbBalanceBefore + arbFee);
    }

    function testArbitratorPool_ConflictOfInterest() public {
        // Create order between buyer and seller
        vm.prank(buyer);
        escrow.createOrder(seller, address(usdt), PRICE, PRODUCT_HASH);

        // Try to assign buyer as arbitrator — should fail
        vm.expectRevert("Conflict of interest");
        arbPool.selectArbitrator(buyer, seller);
    }
}
```

### Gas Benchmarks

```bash
forge test --gas-report
```

Expected output validates gas estimates from [SMART-CONTRACT.md](SMART-CONTRACT.md#gas-estimates):

| Function | Expected | Threshold |
|----------|----------|-----------|
| `createOrder` | ~150,000 | < 200,000 |
| `sellerConfirmDelivery` | ~50,000 | < 80,000 |
| `buyerConfirmReceived` | ~80,000 | < 120,000 |
| `cancelOrder` | ~70,000 | < 100,000 |
| `openDispute` | ~100,000 | < 150,000 |
| `resolveDispute` | ~120,000 | < 180,000 |

If any function exceeds its threshold, investigate gas optimization before merging.

---

## 2. Backend Tests (pytest)

### Running Tests

```bash
cd backend
source venv/bin/activate

# All tests
pytest

# Verbose with print output
pytest -v -s

# Coverage report
pytest --cov=app --cov-report=html --cov-report=term-missing

# Specific file
pytest tests/test_orders.py -v

# Specific test function
pytest tests/test_orders.py::test_create_order_success -v

# Only unit tests (skip integration)
pytest -m "not integration"

# Only integration tests
pytest -m integration

# Parallel execution
pytest -n auto    # requires pytest-xdist

# Linting (not tests, but run in CI)
ruff check .
ruff format --check .
```

### Test Structure

```
backend/tests/
├── conftest.py                     # Shared fixtures (DB, client, auth)
├── unit/
│   ├── test_auth_service.py        # Nonce generation, signature verify
│   ├── test_order_service.py       # Order business logic
│   ├── test_blockchain_service.py  # web3.py interaction (mocked)
│   ├── test_encryption_service.py  # Server-side encryption utilities
│   ├── test_ipfs_service.py        # Pinata interaction (mocked)
│   └── test_reputation.py          # Reputation calculation
├── integration/
│   ├── test_auth_api.py            # POST /auth/nonce, /auth/verify
│   ├── test_products_api.py        # Product CRUD endpoints
│   ├── test_orders_api.py          # Order endpoints
│   ├── test_disputes_api.py        # Dispute endpoints
│   ├── test_messages_api.py        # E2E encrypted messages
│   └── test_websocket.py           # WebSocket events
├── workers/
│   ├── test_event_listener.py      # Blockchain event processing
│   └── test_timeout_checker.py     # Order timeout automation
└── factories.py                    # Test data factories
```

### Fixtures

**conftest.py:**

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import get_db
from app.models.base import Base

TEST_DATABASE_URL = "postgresql+asyncpg://test_user:test_pass@localhost:5432/p2p_escrow_test"

@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(db_engine):
    session_factory = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def buyer_wallet():
    return "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"

@pytest.fixture
def seller_wallet():
    return "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199"

@pytest_asyncio.fixture
async def auth_token(client, buyer_wallet):
    """Authenticate buyer and return JWT token."""
    # Request nonce
    resp = await client.post("/api/auth/nonce", json={"wallet_address": buyer_wallet})
    nonce_data = resp.json()["data"]

    # Mock signature verification for testing
    resp = await client.post("/api/auth/verify", json={
        "wallet_address": buyer_wallet,
        "signature": "0xmocked_signature",
        "public_key": "base64_mocked_public_key",
    })
    return resp.json()["data"]["token"]

@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
```

### API Endpoint Tests

**Example — test_products_api.py:**

```python
import pytest

@pytest.mark.asyncio
class TestProductsAPI:

    async def test_list_products_public(self, client):
        """GET /products should work without auth."""
        resp = await client.get("/api/products")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "items" in data["data"]

    async def test_create_product_requires_auth(self, client):
        """POST /products should reject unauthenticated requests."""
        resp = await client.post("/api/products", json={
            "title_preview": "Test Product",
            "description_preview": "A test product",
            "category": "data",
            "price_usdt": "25.000000",
            "stock": 10,
            "product_hash": "0x" + "ab" * 32,
        })
        assert resp.status_code == 401

    async def test_create_product_success(self, client, auth_headers):
        """POST /products should create product for authenticated seller."""
        resp = await client.post("/api/products", json={
            "title_preview": "Premium Email List",
            "description_preview": "High-quality verified emails",
            "category": "data",
            "price_usdt": "25.000000",
            "stock": 50,
            "product_hash": "0x" + "cd" * 32,
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "active"
        assert "id" in data

    async def test_create_product_validation(self, client, auth_headers):
        """POST /products should reject invalid data."""
        # Price too low
        resp = await client.post("/api/products", json={
            "title_preview": "Cheap Product",
            "description_preview": "Should fail",
            "category": "data",
            "price_usdt": "0.500000",   # Below 1.0 minimum
            "stock": 1,
            "product_hash": "0x" + "ef" * 32,
        }, headers=auth_headers)
        assert resp.status_code == 422

        # Invalid category
        resp = await client.post("/api/products", json={
            "title_preview": "Bad Category",
            "description_preview": "Should fail",
            "category": "invalid_category",
            "price_usdt": "10.000000",
            "stock": 1,
            "product_hash": "0x" + "11" * 32,
        }, headers=auth_headers)
        assert resp.status_code == 422

    async def test_delete_product_only_by_seller(self, client, auth_headers, seller_wallet):
        """DELETE /products/:id should only work for the product's seller."""
        # Create as buyer (who is authenticated)
        resp = await client.post("/api/products", json={
            "title_preview": "My Product",
            "description_preview": "test",
            "category": "tools",
            "price_usdt": "10.000000",
            "stock": 1,
            "product_hash": "0x" + "22" * 32,
        }, headers=auth_headers)
        product_id = resp.json()["data"]["id"]

        # Delete with same auth should work
        resp = await client.delete(f"/api/products/{product_id}", headers=auth_headers)
        assert resp.status_code == 200
```

### Service Layer Tests

**Example — test_reputation.py:**

```python
import pytest
from app.services.reputation import calculate_reputation, determine_tier

class TestReputationCalculation:

    def test_new_user_score(self):
        score = calculate_reputation(
            total_trades=0, five_star_reviews=0,
            disputes_lost=0, disputes_won=0,
            seller_cancels=0, buyer_cancels=0,
        )
        assert score == 0.0

    def test_active_trader(self):
        score = calculate_reputation(
            total_trades=50, five_star_reviews=20,
            disputes_lost=1, disputes_won=2,
            seller_cancels=0, buyer_cancels=3,
        )
        # 50*1 + 20*0.5 - 1*3 + 2*1 - 0*2 - 3*0.5 = 50 + 10 - 3 + 2 - 1.5 = 57.5
        assert score == 57.5

    def test_dispute_heavy_penalty(self):
        score = calculate_reputation(
            total_trades=10, five_star_reviews=0,
            disputes_lost=5, disputes_won=0,
            seller_cancels=3, buyer_cancels=0,
        )
        # 10*1 + 0 - 5*3 + 0 - 3*2 - 0 = 10 - 15 - 6 = -11
        assert score == -11.0

    def test_tier_new(self):
        assert determine_tier(total_trades=5, rating=None) == "new"

    def test_tier_standard(self):
        assert determine_tier(total_trades=50, rating=3.5) == "standard"

    def test_tier_trusted(self):
        assert determine_tier(total_trades=100, rating=4.5) == "trusted"

    def test_tier_trusted_requires_rating(self):
        # 100+ trades but rating below 4.0 → still standard
        assert determine_tier(total_trades=150, rating=3.8) == "standard"
```

### Worker Tests

**Example — test_timeout_checker.py:**

```python
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
class TestTimeoutChecker:

    async def test_seller_timeout_24h(self, db_session):
        """Orders in 'created' status older than 24h should be marked for expiry."""
        from app.workers.timeout_checker import find_expired_orders

        # Insert order created 25 hours ago
        order = create_test_order(
            db_session,
            status="created",
            created_at=datetime.now(timezone.utc) - timedelta(hours=25),
        )
        await db_session.commit()

        expired = await find_expired_orders(db_session, "seller_timeout")
        assert len(expired) == 1
        assert expired[0].id == order.id

    async def test_buyer_timeout_72h(self, db_session):
        """Orders in 'seller_confirmed' status older than 72h should auto-release."""
        from app.workers.timeout_checker import find_expired_orders

        order = create_test_order(
            db_session,
            status="seller_confirmed",
            seller_confirmed_at=datetime.now(timezone.utc) - timedelta(hours=73),
        )
        await db_session.commit()

        expired = await find_expired_orders(db_session, "buyer_timeout")
        assert len(expired) == 1

    async def test_no_false_positives(self, db_session):
        """Recent orders should not be flagged for timeout."""
        create_test_order(
            db_session,
            status="created",
            created_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        await db_session.commit()

        from app.workers.timeout_checker import find_expired_orders
        expired = await find_expired_orders(db_session, "seller_timeout")
        assert len(expired) == 0
```

### WebSocket Tests

```python
import pytest
from httpx_ws.transport import ASGIWebSocketTransport

@pytest.mark.asyncio
class TestWebSocket:

    async def test_connect_with_valid_token(self, client, auth_token, order_id):
        async with client.websocket_connect(
            f"/ws/orders/{order_id}?token={auth_token}"
        ) as ws:
            # Connection should succeed
            assert ws is not None

    async def test_connect_without_token_rejected(self, client, order_id):
        with pytest.raises(Exception):
            async with client.websocket_connect(f"/ws/orders/{order_id}") as ws:
                pass

    async def test_receives_status_change_event(self, client, auth_token, order_id):
        async with client.websocket_connect(
            f"/ws/orders/{order_id}?token={auth_token}"
        ) as ws:
            # Trigger status change (seller confirms delivery)
            # ... simulate event ...

            message = await ws.receive_json()
            assert message["event"] == "status_changed"
            assert message["data"]["new_status"] == "seller_confirmed"
```

### Mocking External Services

| Service | Mock Strategy |
|---------|--------------|
| **PostgreSQL** | Test database (`p2p_escrow_test`) with fixtures. Rolled back after each test. |
| **Redis** | `fakeredis` library or real Redis test instance. Flushed between tests. |
| **Blockchain (web3.py)** | Mock `web3.eth.contract` calls. Use `unittest.mock.patch` on `blockchain_service`. |
| **IPFS (Pinata)** | Mock HTTP calls with `respx` or `httpx.MockTransport`. Return fake CID. |
| **Celery** | Use `celery.contrib.pytest` plugin with `CELERY_ALWAYS_EAGER=True` for synchronous execution. |

**Example — mocking blockchain service:**

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_order_creation_calls_blockchain(client, auth_headers):
    with patch("app.services.blockchain.verify_transaction") as mock_verify:
        mock_verify.return_value = {
            "confirmed": True,
            "order_id": 42,
            "buyer": "0xBuyer...",
            "seller": "0xSeller...",
            "amount": 100_000_000,
        }

        resp = await client.post("/api/orders", json={
            "product_id": "some-uuid",
            "chain": "bsc",
            "token": "USDT",
            "amount": "100.000000",
            "tx_hash_create": "0x" + "ab" * 32,
            "onchain_order_id": 42,
        }, headers=auth_headers)

        assert resp.status_code == 200
        mock_verify.assert_called_once()
```

---

## 3. Frontend Tests

### Running Tests

```bash
cd frontend

# Unit + component tests
npm test                    # vitest
npm test -- --watch         # Watch mode
npm test -- --coverage      # Coverage report

# E2E tests
npm run test:e2e            # Playwright
npx playwright test --ui    # Interactive UI mode

# Linting & type checking
npm run lint
npm run type-check
```

### Test Structure

```
frontend/
├── src/
│   ├── __tests__/                       # Global test utilities
│   │   └── setup.ts                     # Test setup (mocks, providers)
│   ├── components/
│   │   └── product/
│   │       ├── ProductCard.tsx
│   │       └── ProductCard.test.tsx      # Co-located component test
│   ├── hooks/
│   │   ├── useEncryption.ts
│   │   └── useEncryption.test.ts        # Co-located hook test
│   └── lib/
│       ├── encryption.ts
│       └── encryption.test.ts           # Co-located utility test
├── e2e/
│   ├── purchase-flow.spec.ts            # E2E: full purchase
│   ├── dispute-flow.spec.ts             # E2E: dispute resolution
│   └── wallet-connect.spec.ts           # E2E: wallet connection
└── playwright.config.ts
```

### Component Tests

**Example — ProductCard.test.tsx:**

```typescript
import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  const mockProduct = {
    id: 'test-uuid',
    title_preview: 'Premium Email List',
    price_usdt: '25.000000',
    category: 'data',
    seller_display_name: 'CryptoTrader',
    seller_rating: 4.8,
    total_sold: 120,
  };

  it('renders product title and price', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('Premium Email List')).toBeInTheDocument();
    expect(screen.getByText('25 USDT')).toBeInTheDocument();
  });

  it('shows seller info', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('CryptoTrader')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
  });

  it('displays sold count', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('120 sold')).toBeInTheDocument();
  });
});
```

### Hook Tests

**Example — useEncryption.test.ts:**

```typescript
import { renderHook, act } from '@testing-library/react';
import nacl from 'tweetnacl';
import { useEncryption } from './useEncryption';

describe('useEncryption', () => {
  const mockKeypair = nacl.box.keyPair();
  const receiverKeypair = nacl.box.keyPair();

  it('encrypts and decrypts a message round-trip', () => {
    const { result } = renderHook(() => useEncryption(mockKeypair));

    let encrypted: { ciphertext: string; nonce: string };
    act(() => {
      encrypted = result.current.encryptMessage(
        'Hello, World!',
        receiverKeypair.publicKey,
      );
    });

    // Decrypt from receiver's perspective
    const nonceBytes = Buffer.from(encrypted!.nonce, 'base64');
    const cipherBytes = Buffer.from(encrypted!.ciphertext, 'base64');
    const decrypted = nacl.box.open(
      new Uint8Array(cipherBytes),
      new Uint8Array(nonceBytes),
      mockKeypair.publicKey,
      receiverKeypair.secretKey,
    );

    expect(new TextDecoder().decode(decrypted!)).toBe('Hello, World!');
  });

  it('returns null for wrong keypair', () => {
    const { result } = renderHook(() => useEncryption(mockKeypair));

    let encrypted: { ciphertext: string; nonce: string };
    act(() => {
      encrypted = result.current.encryptMessage(
        'Secret message',
        receiverKeypair.publicKey,
      );
    });

    // Try decrypting with wrong key
    const wrongKeypair = nacl.box.keyPair();
    const nonceBytes = Buffer.from(encrypted!.nonce, 'base64');
    const cipherBytes = Buffer.from(encrypted!.ciphertext, 'base64');
    const decrypted = nacl.box.open(
      new Uint8Array(cipherBytes),
      new Uint8Array(nonceBytes),
      mockKeypair.publicKey,
      wrongKeypair.secretKey,
    );

    expect(decrypted).toBeNull();
  });
});
```

### Encryption Tests

**Example — encryption.test.ts:**

```typescript
import nacl from 'tweetnacl';
import { keccak256, toBytes } from 'viem';
import {
  encryptProductKeyForBuyer,
  decryptProductKey,
  encryptMessage,
  decryptMessage,
  encryptEvidence,
} from './encryption';

describe('Encryption utilities', () => {

  describe('Key derivation', () => {
    it('produces deterministic keypair from same signature', () => {
      const signature = '0x' + 'ab'.repeat(65);
      const seed = keccak256(toBytes(signature));
      const secretKey = new Uint8Array(Buffer.from(seed.slice(2), 'hex').slice(0, 32));

      const keypair1 = nacl.box.keyPair.fromSecretKey(secretKey);
      const keypair2 = nacl.box.keyPair.fromSecretKey(secretKey);

      expect(keypair1.publicKey).toEqual(keypair2.publicKey);
      expect(keypair1.secretKey).toEqual(keypair2.secretKey);
    });
  });

  describe('Product key encryption', () => {
    it('encrypts and decrypts product key', () => {
      const sellerKeypair = nacl.box.keyPair();
      const buyerKeypair = nacl.box.keyPair();
      const productKey = nacl.randomBytes(32);

      const encrypted = encryptProductKeyForBuyer(
        productKey, buyerKeypair.publicKey, sellerKeypair.secretKey,
      );

      const decrypted = decryptProductKey(
        encrypted.ciphertext, encrypted.nonce,
        sellerKeypair.publicKey, buyerKeypair.secretKey,
      );

      expect(decrypted).toEqual(productKey);
    });
  });

  describe('E2E messaging', () => {
    it('encrypts and decrypts message round-trip', () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();

      const encrypted = encryptMessage('Hello!', receiver.publicKey, sender.secretKey);
      const decrypted = decryptMessage(
        encrypted.ciphertext, encrypted.nonce,
        sender.publicKey, receiver.secretKey,
      );

      expect(decrypted).toBe('Hello!');
    });

    it('handles unicode messages', () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();

      const encrypted = encryptMessage('Xin chao 🌍', receiver.publicKey, sender.secretKey);
      const decrypted = decryptMessage(
        encrypted.ciphertext, encrypted.nonce,
        sender.publicKey, receiver.secretKey,
      );

      expect(decrypted).toBe('Xin chao 🌍');
    });

    it('returns null with wrong receiver key', () => {
      const sender = nacl.box.keyPair();
      const receiver = nacl.box.keyPair();
      const wrong = nacl.box.keyPair();

      const encrypted = encryptMessage('Secret', receiver.publicKey, sender.secretKey);
      const decrypted = decryptMessage(
        encrypted.ciphertext, encrypted.nonce,
        sender.publicKey, wrong.secretKey,
      );

      expect(decrypted).toBeNull();
    });
  });

  describe('Evidence encryption', () => {
    it('encrypts evidence accessible by all 3 parties', async () => {
      const buyer = nacl.box.keyPair();
      const seller = nacl.box.keyPair();
      const arbitrator = nacl.box.keyPair();

      const evidenceData = new TextEncoder().encode('Proof of delivery');
      const parties = [
        { wallet: '0xBuyer', publicKey: buyer.publicKey },
        { wallet: '0xSeller', publicKey: seller.publicKey },
        { wallet: '0xArbitrator', publicKey: arbitrator.publicKey },
      ];

      const { ipfsPayload } = await encryptEvidence(
        evidenceData.buffer, parties, buyer.secretKey,
      );

      // Each party should have an encrypted key entry
      expect(Object.keys(ipfsPayload.keys)).toHaveLength(3);
      expect(ipfsPayload.encrypted_data).toBeTruthy();
      expect(ipfsPayload.iv).toBeTruthy();
    });
  });
});
```

### E2E Tests (Playwright)

**playwright.config.ts:**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

**Example — e2e/purchase-flow.spec.ts:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Purchase Flow', () => {

  test('buyer can browse marketplace without wallet', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByText('Browse Products')).toBeVisible();
    // Product cards should render
    await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible();
  });

  test('buy button requires wallet connection', async ({ page }) => {
    await page.goto('/product/test-product-id');
    await page.click('[data-testid="buy-button"]');
    // Should show wallet connect modal
    await expect(page.getByText('Connect Wallet')).toBeVisible();
  });

  // Full purchase flow requires wallet mock (e.g., Synpress or custom mock)
  // See: https://github.com/Synthetixio/synpress for MetaMask automation
});
```

> **Note**: Full E2E tests with real wallet interactions require [Synpress](https://github.com/Synthetixio/synpress) or a custom wallet mock. These tests are slower and run only on PRs to `main`.

---

## 4. Test Scenarios

### Happy Path: Purchase Flow

```
 Step  │ Action                         │ Expected Result                        │ Verified By
───────┼────────────────────────────────┼────────────────────────────────────────┼────────────────────
  1    │ Seller lists product           │ Product visible in marketplace         │ Backend + Frontend
  2    │ Buyer clicks "Buy"             │ Approve TX prompt in wallet            │ Frontend
  3    │ Buyer approves USDT            │ Allowance set on token contract        │ Contract test
  4    │ Buyer creates order            │ Funds locked, OrderCreated emitted     │ Contract test
  5    │ Event synced to DB             │ Order appears in buyer dashboard       │ Worker + API test
  6    │ Seller confirms delivery       │ SellerConfirmed emitted                │ Contract test
  7    │ Seller sends encrypted key     │ product_key_encrypted stored           │ API test
  8    │ Buyer decrypts product key     │ Correct AES key recovered              │ Encryption test
  9    │ Buyer verifies product hash    │ SHA-256 matches on-chain hash          │ Frontend test
  10   │ Buyer confirms receipt         │ Funds released, OrderCompleted emitted │ Contract test
  11   │ Seller receives payment        │ USDT balance increased by amount       │ Contract test
  12   │ Treasury receives fee          │ USDT balance increased by 2%           │ Contract test
  13   │ Both parties can leave review  │ Review stored in DB                    │ API test
```

### Dispute Flow

```
 Step  │ Action                         │ Expected Result                        │ Verified By
───────┼────────────────────────────────┼────────────────────────────────────────┼────────────────────
  1    │ Buyer opens dispute            │ DisputeOpened emitted                  │ Contract test
  2    │ Arbitrator assigned            │ No conflict of interest                │ Contract + Service
  3    │ Buyer uploads evidence         │ Encrypted, pinned to IPFS             │ Encryption + IPFS
  4    │ Seller uploads evidence        │ Encrypted, pinned to IPFS             │ Encryption + IPFS
  5    │ Arbitrator decrypts evidence   │ Can read both parties' evidence        │ Encryption test
  6a   │ Resolve: favor buyer           │ Buyer gets (amount - 5%), arb gets 5% │ Contract test
  6b   │ Resolve: favor seller          │ Seller gets (amount - 5%)             │ Contract test
  7    │ Arbitrator reputation updated  │ +2 if consistent, -5 if not           │ ArbitratorPool test
```

### Timeout & Auto-Expiry

```
 Scenario                         │ Trigger               │ Expected                │ Test Method
──────────────────────────────────┼───────────────────────┼─────────────────────────┼─────────────────
 Seller doesn't confirm (24h)     │ vm.warp(+24h)         │ Refund buyer            │ Contract: testAutoExpire_After24h
 Buyer doesn't respond (72h)      │ vm.warp(+72h)         │ Release to seller       │ Contract: testAutoRelease_After72h
 Timeout check finds expired      │ Celery periodic task   │ Orders returned in scan │ Worker: test_seller_timeout_24h
 No false positive on recent      │ Order < 24h old        │ Not flagged             │ Worker: test_no_false_positives
```

### Encryption Round-Trip

```
 Scenario                         │ Test
──────────────────────────────────┼───────────────────────────────────────────────────
 Same keypair from same wallet    │ Key derivation deterministic
 Message encrypt → decrypt        │ Plaintext round-trips correctly
 Product key encrypt → decrypt    │ AES key round-trips correctly
 Evidence encrypt → all 3 decrypt │ Buyer, seller, arbitrator can all read
 Wrong key → null                 │ nacl.box.open returns null
 Unicode message support          │ Multi-byte chars survive round-trip
 Empty message                    │ Encrypt/decrypt handles zero-length input
```

### Edge Cases

| Scenario | Expected Behavior | Test |
|----------|------------------|------|
| Buyer == seller | Rejected on-chain and in API | Contract + API validation |
| Amount = 0.99 USDT | Rejected (below minimum 1 USDT) | Contract + API validation |
| Amount = MAX_UINT256 | Rejected (insufficient balance) | Contract fuzz test |
| Double cancellation | Second cancel reverts | Contract test |
| Confirm after cancel | Reverts (invalid transition) | Contract test |
| Dispute already open | Reverts with `DISPUTE_ALREADY_OPEN` | Contract + API test |
| Blacklisted wallet | Rejected at auth and order creation | API integration test |
| New seller limit exceeded | `SELLER_LIMIT_EXCEEDED` error | API integration test |
| Concurrent order creation | Only one succeeds per unique `(chain, onchain_order_id)` | Database constraint |
| WebSocket with expired JWT | Connection rejected with 403 | WebSocket test |
| Message to non-participant | Rejected by API | API integration test |
| Review on incomplete order | Rejected by API | API integration test |
| Double review same order | Rejected by unique constraint | API + Database |

---

## 5. Test Data & Fixtures

### Wallet Fixtures

Standard test wallets (deterministic for reproducibility):

```python
# backend/tests/factories.py
TEST_WALLETS = {
    "buyer":      "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    "seller":     "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    "arbitrator": "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
    "admin":      "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
    "blacklisted":"0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
}
```

```solidity
// contracts/test/helpers/BaseTest.sol
address buyer      = makeAddr("buyer");      // Deterministic in Foundry
address seller     = makeAddr("seller");
address arbitrator = makeAddr("arbitrator");
```

### Database Seed Data

```python
# backend/tests/factories.py
from app.models import UserProfile, Product, Order

def create_test_user(db, wallet, **overrides):
    user = UserProfile(
        wallet=wallet,
        display_name=overrides.get("display_name", "TestUser"),
        public_key=overrides.get("public_key", "base64_test_key_" + wallet[:8]),
        tier=overrides.get("tier", "new"),
        **{k: v for k, v in overrides.items() if k not in ("display_name", "public_key", "tier")},
    )
    db.add(user)
    return user

def create_test_product(db, seller_wallet, **overrides):
    product = Product(
        seller_wallet=seller_wallet,
        title_preview=overrides.get("title_preview", "Test Product"),
        description_preview=overrides.get("description_preview", "A test product"),
        category=overrides.get("category", "data"),
        price_usdt=overrides.get("price_usdt", 25.0),
        stock=overrides.get("stock", 10),
        product_hash=overrides.get("product_hash", "0x" + "ab" * 32),
        **{k: v for k, v in overrides.items()
           if k not in ("title_preview", "description_preview", "category",
                        "price_usdt", "stock", "product_hash")},
    )
    db.add(product)
    return product

def create_test_order(db, buyer_wallet=None, seller_wallet=None, **overrides):
    order = Order(
        onchain_order_id=overrides.get("onchain_order_id", 1),
        chain=overrides.get("chain", "bsc"),
        buyer_wallet=buyer_wallet or TEST_WALLETS["buyer"],
        seller_wallet=seller_wallet or TEST_WALLETS["seller"],
        product_id=overrides.get("product_id"),
        token=overrides.get("token", "USDT"),
        amount=overrides.get("amount", 25.0),
        platform_fee=overrides.get("platform_fee", 0.5),
        status=overrides.get("status", "created"),
        tx_hash_create=overrides.get("tx_hash_create", "0x" + "cd" * 32),
        **{k: v for k, v in overrides.items()
           if k not in ("onchain_order_id", "chain", "product_id", "token",
                        "amount", "platform_fee", "status", "tx_hash_create")},
    )
    db.add(order)
    return order
```

### Mock Contract State

```solidity
// contracts/test/helpers/MockERC20.sol
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 dec)
        ERC20(name, symbol)
    {
        _decimals = dec;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

---

## 6. CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # ── Smart Contract Tests ──────────────────
  contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Run tests
        working-directory: contracts
        run: forge test -vvv

      - name: Check coverage
        working-directory: contracts
        run: |
          forge coverage --report summary
          # Fail if below 95%
          forge coverage --report lcov
          COVERAGE=$(forge coverage 2>&1 | grep "^|" | tail -1 | awk '{print $10}' | tr -d '%')
          if (( $(echo "$COVERAGE < 95" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 95% threshold"
            exit 1
          fi

      - name: Gas report
        working-directory: contracts
        run: forge test --gas-report

  # ── Backend Tests ─────────────────────────
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: p2p_escrow_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        working-directory: backend
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Lint
        working-directory: backend
        run: |
          ruff check .
          ruff format --check .

      - name: Run tests
        working-directory: backend
        env:
          DATABASE_URL: postgresql+asyncpg://test_user:test_pass@localhost:5432/p2p_escrow_test
          REDIS_URL: redis://localhost:6379/0
          JWT_SECRET: test_secret_key_for_ci_only_not_production
          APP_ENV: development
        run: pytest --cov=app --cov-report=xml --cov-fail-under=85

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: backend/coverage.xml

  # ── Frontend Tests ────────────────────────
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Lint & type check
        working-directory: frontend
        run: |
          npm run lint
          npm run type-check

      - name: Unit tests
        working-directory: frontend
        run: npm test -- --coverage --reporter=junit

      - name: Upload coverage
        uses: codecov/codecov-action@v4

  # ── E2E Tests (on PRs to main only) ──────
  e2e:
    runs-on: ubuntu-latest
    if: github.base_ref == 'main'
    needs: [contracts, backend, frontend]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install Playwright
        working-directory: frontend
        run: |
          npm ci
          npx playwright install --with-deps

      - name: Run E2E tests
        working-directory: frontend
        run: npm run test:e2e

      - name: Upload traces
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces
          path: frontend/test-results/
```

### CI Checklist Per PR

| Check | Contracts | Backend | Frontend |
|-------|-----------|---------|----------|
| Lint | — | `ruff check` | `eslint` |
| Type check | Solidity compiler | `mypy` (optional) | `tsc --noEmit` |
| Unit tests | `forge test` | `pytest -m "not integration"` | `vitest` |
| Integration tests | `forge test` (multi-contract) | `pytest -m integration` | — |
| Fuzz tests | `forge test --match-test testFuzz` | — | — |
| Coverage check | >= 95% | >= 85% | >= 75% |
| Gas report | `forge test --gas-report` | — | — |
| E2E tests | — | — | Playwright (main only) |

---

## 7. Performance Testing

### API Load Testing (Locust)

```python
# backend/tests/performance/locustfile.py
from locust import HttpUser, task, between

class MarketplaceUser(HttpUser):
    wait_time = between(1, 3)

    @task(10)
    def browse_products(self):
        self.client.get("/api/products?page=1&limit=20")

    @task(5)
    def view_product(self):
        self.client.get("/api/products/some-test-uuid")

    @task(2)
    def search_products(self):
        self.client.get("/api/products?search=email&category=data")

    @task(1)
    def get_orders(self):
        self.client.get("/api/orders", headers=self.auth_headers)

    def on_start(self):
        # Authenticate once per user
        resp = self.client.post("/api/auth/nonce", json={"wallet_address": "0xTestWallet"})
        # ... complete auth flow ...
        self.auth_headers = {"Authorization": f"Bearer {token}"}
```

**Run:**

```bash
cd backend
locust -f tests/performance/locustfile.py --host=https://api-staging.yourdomain.com
# Open http://localhost:8089 for web UI
```

**Performance targets:**

| Endpoint | Concurrent Users | Target p95 | Max p99 |
|----------|-----------------|-----------|---------|
| `GET /products` | 100 | < 200ms | < 500ms |
| `GET /products/:id` | 100 | < 100ms | < 300ms |
| `POST /orders` | 50 | < 500ms | < 1s |
| `GET /orders` | 50 | < 200ms | < 500ms |
| WebSocket connect | 200 | < 1s | < 3s |

### Database Query Performance

```sql
-- Enable query timing
\timing on

-- Test product listing query
EXPLAIN ANALYZE
SELECT p.*, u.display_name, u.rating
FROM products p JOIN user_profiles u ON u.wallet = p.seller_wallet
WHERE p.status = 'active' AND p.deleted_at IS NULL
ORDER BY p.created_at DESC LIMIT 20;

-- Expected: Index Scan, < 50ms execution time
```

---

## 8. Security Testing

### Smart Contract Security

| Test Type | Tool | Purpose |
|-----------|------|---------|
| Static analysis | Slither | Detect common vulnerability patterns |
| Fuzz testing | Foundry fuzzer | Random input edge cases |
| Formal verification | Certora (optional) | Mathematical proof of invariants |
| Manual audit | External auditor | Comprehensive security review |

```bash
# Slither static analysis
cd contracts
slither src/P2PEscrow.sol --config-file slither.config.json

# Mythril (symbolic execution)
myth analyze src/P2PEscrow.sol --solc-json remappings.json
```

**Contract invariants to verify:**

- Total funds in contract == sum of all active order amounts + platform fees
- No order can be in two states simultaneously
- Only buyer can cancel, only seller can confirm delivery
- Arbitrator cannot be buyer or seller
- Paused contract blocks all state-changing functions

### Backend Security Tests

```python
@pytest.mark.asyncio
class TestSecurityHeaders:

    async def test_security_headers_present(self, client):
        resp = await client.get("/api/products")
        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"

    async def test_cors_rejects_unknown_origin(self, client):
        resp = await client.options("/api/products", headers={
            "Origin": "https://evil.com",
            "Access-Control-Request-Method": "GET",
        })
        assert "Access-Control-Allow-Origin" not in resp.headers

    async def test_rate_limiting(self, client, auth_headers):
        # Send 101 requests (limit is 100/min)
        for _ in range(101):
            resp = await client.get("/api/products", headers=auth_headers)
        assert resp.status_code == 429

    async def test_sql_injection_prevented(self, client):
        resp = await client.get("/api/products?search=' OR 1=1 --")
        assert resp.status_code == 200  # Should return empty, not error

    async def test_jwt_tampering_rejected(self, client):
        resp = await client.get("/api/orders", headers={
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.tampered.payload"
        })
        assert resp.status_code == 401

    async def test_blacklisted_wallet_rejected(self, client):
        resp = await client.post("/api/auth/nonce", json={
            "wallet_address": TEST_WALLETS["blacklisted"],
        })
        assert resp.status_code == 403
```

### OWASP Checklist

| Vulnerability | Mitigation | Test |
|---------------|-----------|------|
| SQL Injection | SQLAlchemy ORM (parameterized) | Inject payloads in search params |
| XSS | No `dangerouslySetInnerHTML`, text rendering | Input payloads in product titles |
| CSRF | Stateless JWT (no cookies) | N/A — not applicable |
| Broken Auth | Wallet signature + JWT | Tampered tokens, expired tokens |
| Rate Limiting | Redis sliding window | Burst requests exceed limit |
| IDOR | Ownership checks on all endpoints | Access other user's orders |
| Sensitive Data | E2E encryption, no PII logging | Verify logs contain no secrets |
