# Smart Contract Documentation

## Overview

The P2P Escrow system consists of two primary contracts:

1. **P2PEscrow** — Core escrow logic handling order lifecycle, fund locking, and release
2. **ArbitratorPool** — Arbitrator staking, selection, and reputation management

Both contracts are written in Solidity ^0.8.20 and use OpenZeppelin libraries.

## P2PEscrow Contract

### State Variables

```solidity
// Configuration
uint256 public constant PLATFORM_FEE_BPS = 200;      // 2% (basis points)
uint256 public constant ARB_FEE_BPS = 500;            // 5%
uint256 public constant SELLER_TIMEOUT = 24 hours;
uint256 public constant CONFIRM_WINDOW = 72 hours;
uint256 public constant DISPUTE_WINDOW = 7 days;
uint256 public constant MIN_ORDER_AMOUNT = 1e6;       // 1 USDT (6 decimals)

// State
uint256 public nextOrderId;
address public treasury;
address public arbitratorPool;
mapping(uint256 => Order) public orders;
mapping(address => bool) public supportedTokens;      // USDT, USDC addresses
```

### Data Structures

```solidity
enum OrderStatus {
    Created,           // Buyer locked funds
    SellerConfirmed,   // Seller confirmed delivery
    Completed,         // Buyer confirmed receipt → funds released
    Disputed,          // Dispute opened, awaiting arbitrator
    ResolvedBuyer,     // Arbitrator ruled for buyer
    ResolvedSeller,    // Arbitrator ruled for seller
    Cancelled,         // Buyer cancelled before seller confirmed
    Expired            // Auto-expired due to timeout
}

struct Order {
    uint256 id;
    address buyer;
    address seller;
    address arbitrator;
    address token;              // USDT or USDC contract address
    uint256 amount;             // Product price
    uint256 platformFee;        // 2% of amount
    uint256 arbitrationFee;     // 5% (calculated only on dispute)
    OrderStatus status;
    bytes32 productHash;        // SHA-256 hash for product integrity
    uint256 createdAt;
    uint256 sellerConfirmedAt;
    uint256 disputeDeadline;
    string evidenceBuyer;       // IPFS hash (encrypted)
    string evidenceSeller;      // IPFS hash (encrypted)
}
```

### Events

```solidity
event OrderCreated(
    uint256 indexed orderId,
    address indexed buyer,
    address indexed seller,
    address token,
    uint256 amount,
    bytes32 productHash
);

event SellerConfirmed(
    uint256 indexed orderId,
    uint256 confirmedAt
);

event OrderCompleted(
    uint256 indexed orderId,
    uint256 amountToSeller,
    uint256 platformFee
);

event OrderCancelled(
    uint256 indexed orderId,
    address cancelledBy
);

event OrderExpired(
    uint256 indexed orderId,
    uint8 reason     // 0 = seller timeout, 1 = auto-release
);

event DisputeOpened(
    uint256 indexed orderId,
    address indexed openedBy,
    string evidenceHash
);

event EvidenceSubmitted(
    uint256 indexed orderId,
    address indexed submitter,
    string evidenceHash
);

event DisputeResolved(
    uint256 indexed orderId,
    address indexed arbitrator,
    bool favorBuyer,
    uint256 arbitrationFee
);
```

### Functions

#### Buyer Functions

##### `createOrder(address seller, address token, uint256 amount, bytes32 productHash)`

Creates a new escrow order and locks buyer's funds.

- **Requires**: `token` is supported, `amount >= MIN_ORDER_AMOUNT`, `seller != msg.sender`
- **Token transfer**: `amount + platformFee` transferred from buyer to contract
- **Emits**: `OrderCreated`

```
Checks:
  ✓ Token is supported (USDT or USDC)
  ✓ Amount >= 1 USDT
  ✓ Seller != buyer
  ✓ Buyer has approved sufficient allowance

State changes:
  - Creates Order struct with status = Created
  - Increments nextOrderId
  - Transfers (amount + platformFee) from buyer via SafeERC20
```

##### `buyerConfirmReceived(uint256 orderId)`

Buyer confirms receipt of product, releasing funds to seller.

- **Requires**: `msg.sender == order.buyer`, `status == SellerConfirmed`
- **Transfers**: `amount` to seller, `platformFee` to treasury
- **Emits**: `OrderCompleted`

##### `cancelOrder(uint256 orderId)`

Buyer cancels order before seller confirms delivery.

- **Requires**: `msg.sender == order.buyer`, `status == Created`
- **Transfers**: Full refund (`amount + platformFee`) to buyer
- **Emits**: `OrderCancelled`

#### Seller Functions

##### `sellerConfirmDelivery(uint256 orderId)`

Seller confirms they have delivered the product.

- **Requires**: `msg.sender == order.seller`, `status == Created`
- **Sets**: `sellerConfirmedAt = block.timestamp`
- **Emits**: `SellerConfirmed`

##### `submitEvidence(uint256 orderId, string calldata ipfsHash)`

Seller submits dispute evidence.

- **Requires**: `msg.sender == order.seller`, `status == Disputed`
- **Emits**: `EvidenceSubmitted`

#### Shared Functions

##### `openDispute(uint256 orderId, string calldata evidenceHash)`

Either buyer or seller opens a dispute.

- **Requires**: `msg.sender` is buyer or seller, `status` is `Created` or `SellerConfirmed`
- **Sets**: `status = Disputed`, `disputeDeadline = block.timestamp + DISPUTE_WINDOW`
- **Assigns**: Arbitrator from ArbitratorPool (conflict-of-interest check)
- **Emits**: `DisputeOpened`

#### Arbitrator Functions

##### `resolveDispute(uint256 orderId, bool favorBuyer)`

Arbitrator resolves a dispute.

- **Requires**: `msg.sender == order.arbitrator`, `status == Disputed`
- **If `favorBuyer`**:
  - `amount - arbitrationFee` → buyer
  - `arbitrationFee` → arbitrator
  - `platformFee` → treasury
  - Status → `ResolvedBuyer`
- **If `!favorBuyer`**:
  - `amount - arbitrationFee` → seller
  - `arbitrationFee` → arbitrator
  - `platformFee` → treasury
  - Status → `ResolvedSeller`
- **Emits**: `DisputeResolved`

#### Automation Functions (Keeper/Cron)

##### `autoExpireOrder(uint256 orderId)`

Auto-expire order if seller doesn't confirm within 24 hours.

- **Requires**: `status == Created`, `block.timestamp > createdAt + SELLER_TIMEOUT`
- **Transfers**: Full refund to buyer
- **Emits**: `OrderExpired(orderId, 0)`

##### `autoReleaseToSeller(uint256 orderId)`

Auto-release funds to seller if buyer doesn't confirm/dispute within 72 hours.

- **Requires**: `status == SellerConfirmed`, `block.timestamp > sellerConfirmedAt + CONFIRM_WINDOW`
- **Transfers**: `amount` to seller, `platformFee` to treasury
- **Emits**: `OrderExpired(orderId, 1)`

#### Admin Functions

##### `setSupportedToken(address token, bool supported)` (onlyOwner)

Add or remove supported payment tokens.

##### `setTreasury(address newTreasury)` (onlyOwner)

Update treasury address. Subject to timelock.

##### `pause()` / `unpause()` (onlyOwner)

Emergency circuit breaker. Pauses all state-changing functions.

### Security Features

- **ReentrancyGuard** on all functions with token transfers
- **SafeERC20** for all token operations (handles non-standard tokens like USDT)
- **msg.sender verification** on every state-changing function
- **Pausable** for emergency circuit breaker
- **No delegatecall** — no proxy pattern to reduce attack surface

---

## ArbitratorPool Contract

### State Variables

```solidity
uint256 public constant MIN_STAKE = 500e6;            // 500 USDT
uint256 public constant INITIAL_REPUTATION = 50;
uint256 public constant MAX_REPUTATION = 100;
address public stakeToken;                             // USDT address
mapping(address => Arbitrator) public arbitrators;
address[] public activeArbitrators;
```

### Data Structures

```solidity
struct Arbitrator {
    address addr;
    uint256 stake;
    uint256 reputation;         // 0-100, starts at 50
    uint256 totalResolved;
    uint256 totalEarned;
    bool isActive;
}
```

### Functions

##### `register(uint256 stakeAmount)`

Register as an arbitrator by staking tokens.

- **Requires**: `stakeAmount >= MIN_STAKE`, not already registered
- **Transfers**: `stakeAmount` from caller to contract
- **Sets**: Initial reputation = 50

##### `increaseStake(uint256 amount)`

Add more stake to existing position.

##### `withdraw()`

Withdraw stake and deactivate. Cannot withdraw while actively assigned to disputes.

##### `selectArbitrator(address buyer, address seller) → address`

Select a random arbitrator weighted by reputation. Called by P2PEscrow.

- **Conflict check**: Selected arbitrator must not be buyer or seller
- **Weighting**: Higher reputation = higher selection probability
- **Algorithm**: Weighted random using `blockhash` + cumulative reputation scores

##### `updateReputation(address arbitrator, bool consistent)`

Update arbitrator reputation after dispute resolution. Called by P2PEscrow.

- **If consistent** (resolution aligned with evidence): reputation += 2 (capped at 100)
- **If inconsistent**: reputation -= 5 (floored at 0)
- **Deactivate** if reputation drops below 10

---

## Deployment

### Chain-Specific Configuration

| Chain | USDT Address | USDC Address | Block Confirmations |
|-------|-------------|-------------|-------------------|
| BSC | `0x55d398326f99059fF775485246999027B3197955` | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | 15 |
| Ethereum | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | 12 |
| Arbitrum | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 1 |
| Base | - | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 1 |

### Deployment Steps

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env: PRIVATE_KEY, RPC_URL, ETHERSCAN_API_KEY

# 2. Deploy to testnet first
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify

# 3. Verify on block explorer
forge verify-contract <address> P2PEscrow --chain bsc

# 4. Configure supported tokens
cast send <escrow_address> "setSupportedToken(address,bool)" <usdt_address> true

# 5. Set treasury
cast send <escrow_address> "setTreasury(address)" <treasury_address>
```

### Gas Estimates

| Function | Estimated Gas |
|----------|-------------|
| createOrder | ~150,000 |
| sellerConfirmDelivery | ~50,000 |
| buyerConfirmReceived | ~80,000 |
| cancelOrder | ~70,000 |
| openDispute | ~100,000 |
| resolveDispute | ~120,000 |
| autoExpireOrder | ~70,000 |
| autoReleaseToSeller | ~80,000 |

### Testing

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvvv

# Run specific test
forge test --match-test testCreateOrder

# Gas report
forge test --gas-report

# Coverage
forge coverage
```

Target: >= 95% code coverage.
