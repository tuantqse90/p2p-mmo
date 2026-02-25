# Contributing

## Development Setup

### Prerequisites

- **Node.js** >= 18 (recommend using `nvm`)
- **Python** >= 3.11
- **Foundry** (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** (optional, for containerized development)

### Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd p2p-mmo

# Smart contracts
cd contracts
forge install

# Backend
cd ../backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Frontend
cd ../frontend
npm install
```

### Environment Configuration

```bash
# Backend
cp backend/.env.example backend/.env
# Edit with your local PostgreSQL, Redis URLs

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit with local API URL, testnet contract addresses
```

---

## Code Standards

### Smart Contracts (Solidity)

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- NatSpec comments on all public/external functions
- Events for every state change
- Test coverage >= 95%
- Gas optimization where meaningful (avoid premature optimization)

```solidity
/// @notice Creates a new escrow order
/// @param seller The seller's wallet address
/// @param token The payment token address (USDT/USDC)
/// @param amount The product price in token's smallest unit
/// @param productHash SHA-256 hash of the product for integrity verification
/// @return orderId The ID of the created order
function createOrder(
    address seller,
    address token,
    uint256 amount,
    bytes32 productHash
) external nonReentrant whenNotPaused returns (uint256 orderId) {
```

### Backend (Python)

- Type hints on all functions
- Async/await for I/O operations
- Pydantic models for request/response validation
- Follow PEP 8 (enforced by `ruff`)
- Docstrings on public functions

```python
async def create_order(
    order_data: OrderCreate,
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    """Create a new order after on-chain transaction confirmation."""
```

### Frontend (TypeScript)

- TypeScript strict mode (`strict: true` in tsconfig)
- React Server Components by default, Client Components only when needed
- Custom hooks for blockchain interaction
- No `any` types
- Consistent naming: `PascalCase` for components, `camelCase` for functions/variables

```typescript
// Custom hook pattern
export function useEscrowContract() {
  const { data: walletClient } = useWalletClient();
  // ...
}
```

---

## Git Workflow

### Branch Strategy

```
main            ← Production-ready code
├── develop     ← Integration branch
│   ├── feature/xxx    ← New features
│   ├── fix/xxx        ← Bug fixes
│   └── refactor/xxx   ← Code improvements
```

### Branch Naming

```
feature/add-dispute-resolution
fix/order-timeout-calculation
refactor/encryption-utils
docs/api-reference-update
test/escrow-edge-cases
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(contract): add auto-expire for seller timeout
fix(backend): correct JWT expiry calculation
docs(api): update order endpoint response format
test(contract): add fuzz tests for createOrder
refactor(frontend): extract encryption hook
chore(deps): update OpenZeppelin to 5.x
```

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes with clear, atomic commits
3. Ensure all tests pass locally
4. Open PR against `develop`
5. Fill out PR template (description, test plan, screenshots if UI)
6. Request review from at least 1 team member
7. Address review feedback
8. Squash merge after approval

### PR Checklist

- [ ] Tests added/updated for changes
- [ ] No new TypeScript/linting errors
- [ ] Smart contract changes have >= 95% coverage
- [ ] API changes documented in `docs/API.md`
- [ ] No secrets or PII in code
- [ ] Migration script included (if DB changes)
- [ ] Manual testing completed on testnet (if contract changes)

---

## Testing

### Smart Contracts

```bash
cd contracts

# Unit tests
forge test

# With gas report
forge test --gas-report

# Specific test
forge test --match-test testCreateOrder -vvvv

# Fuzz testing (built into Foundry)
forge test --match-test testFuzz

# Coverage
forge coverage
```

### Backend

```bash
cd backend
source venv/bin/activate

# All tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific module
pytest tests/test_orders.py -v

# Linting
ruff check .
ruff format .
```

### Frontend

```bash
cd frontend

# Unit tests
npm test

# E2E tests
npm run test:e2e

# Linting
npm run lint

# Type checking
npm run type-check
```

---

## Adding a New Chain

To add support for a new EVM chain:

1. **Contract**: Deploy `P2PEscrow` and `ArbitratorPool` to the new chain
2. **Backend**: Add chain config in `app/core/config.py` (RPC URL, block confirmations, token addresses)
3. **Backend**: Add Celery worker for the new chain's event listener
4. **Frontend**: Add chain to wagmi config in `lib/config.ts`
5. **Frontend**: Add contract addresses for the chain
6. **Docs**: Update chain support table in README and SMART-CONTRACT.md
7. **Test**: Full integration test on testnet

---

## Security Considerations

When contributing, always:

- Validate all inputs server-side (never trust client data)
- Use parameterized queries (SQLAlchemy ORM handles this)
- Never log PII, tokens, or secrets
- Never store plaintext sensitive data
- Use `SafeERC20` for all token operations
- Add `ReentrancyGuard` to functions with external calls
- Check `msg.sender` authorization in every contract function
- Review for OWASP Top 10 vulnerabilities

Report security vulnerabilities privately — do not open public issues for security bugs.
