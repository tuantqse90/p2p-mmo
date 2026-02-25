# Security

## Overview

Security is implemented across all layers: smart contracts, backend, frontend, and infrastructure. The platform follows a defense-in-depth approach with the principle of least privilege.

## Smart Contract Security

### Protections

| Protection | Implementation | Purpose |
|-----------|---------------|---------|
| Reentrancy Guard | OpenZeppelin `ReentrancyGuard` | Prevent reentrant calls on all transfer functions |
| Safe Token Transfers | OpenZeppelin `SafeERC20` | Handle non-standard ERC-20 tokens (USDT) |
| Access Control | `msg.sender` checks on every function | Only authorized parties can act |
| Emergency Pause | OpenZeppelin `Pausable` | Circuit breaker for critical situations |
| Timelock | Admin functions have timelock delay | Prevent instant malicious admin actions |
| Input Validation | Require statements on all inputs | Prevent invalid state transitions |
| Integer Safety | Solidity ^0.8.20 built-in overflow checks | Prevent arithmetic overflow/underflow |

### State Machine Enforcement

Every order follows a strict state machine. Invalid transitions are rejected:

```
Created → SellerConfirmed → Completed
Created → Cancelled
Created → Expired (auto, 24h)
Created → Disputed → ResolvedBuyer | ResolvedSeller
SellerConfirmed → Completed
SellerConfirmed → Expired (auto-release, 72h)
SellerConfirmed → Disputed → ResolvedBuyer | ResolvedSeller
```

No other transitions are possible. Each function checks the current status before proceeding.

### Block Confirmation Requirements

| Chain | Confirmations | Approximate Time |
|-------|-------------|-----------------|
| BSC | 15 | ~45 seconds |
| Ethereum | 12 | ~2.4 minutes |
| Arbitrum | 1 | ~0.25 seconds |
| Base | 1 | ~2 seconds |

The backend waits for the required confirmations before updating order status.

### Audit Checklist

- [ ] No external calls before state changes (checks-effects-interactions)
- [ ] ReentrancyGuard on all functions with token transfers
- [ ] SafeERC20 for all token operations
- [ ] No delegatecall or selfdestruct
- [ ] No assembly blocks (unless gas-critical and audited)
- [ ] All events emitted for off-chain tracking
- [ ] Access control on every state-changing function
- [ ] Tested with >= 95% coverage
- [ ] Fuzz testing for edge cases
- [ ] Formal verification for critical paths (optional)

---

## Backend Security

### Authentication

- **Wallet Signature Auth**: No passwords stored. Users sign a message with their wallet.
- **JWT Tokens**: 24-hour expiry, signed with HS256
- **Nonce Replay Prevention**: Each nonce is single-use, stored in Redis with 5-minute TTL
- **No Session Persistence**: Stateless JWT — no server-side session storage beyond nonce

### Rate Limiting

```
Global:             100 requests/min per wallet address
Auth endpoints:     10 requests/min per IP
Product creation:   5 requests/min per wallet
Order creation:     10 requests/min per wallet
Message sending:    30 requests/min per wallet
WebSocket:          1 connection per order per wallet
```

Implemented via Redis sliding window counters.

### Input Validation

- All API inputs validated with **Pydantic** schemas
- Wallet addresses validated (checksum format)
- Transaction hashes validated (hex format, length)
- IPFS hashes validated (CID format)
- String lengths enforced
- Numeric ranges enforced (min/max order amounts)
- SQL injection prevented by SQLAlchemy ORM (parameterized queries)

### CORS Policy

```python
CORS_ORIGINS = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
]
# No wildcard origins in production
```

### Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

### Logging Policy

**What IS logged:**
- API request method + path (no body)
- Response status codes
- Error messages (generic, no PII)
- Wallet addresses (public data)
- Rate limit violations
- Authentication failures

**What is NEVER logged:**
- IP addresses
- Request bodies containing encrypted data
- JWT tokens
- Signatures
- User-Agent strings
- Any PII

---

## Anti-Fraud System

### New Seller Restrictions

New sellers (account age < 7 days) have restricted limits:

| Restriction | New Seller | Standard | Trusted (100+ trades) |
|------------|-----------|----------|----------------------|
| Max orders/day | 3 | 20 | Unlimited |
| Max order value | 50 USDT | 500 USDT | 10,000 USDT |
| Withdrawal delay | 48 hours | 24 hours | Instant |
| Required confirmations | Extra 5 | Standard | Standard |

### Reputation System

```
Rating calculation:
  - Starts at 0 (neutral)
  - Each completed trade: +1 to both parties
  - Each 5-star review: +0.5
  - Each dispute lost: -3
  - Each dispute won: +1
  - Seller cancel: -2
  - Buyer cancel: -0.5 (within allowed window)

Tier thresholds:
  - New:      0-9 trades
  - Standard: 10-99 trades
  - Trusted:  100+ trades, rating >= 4.0
```

### Blacklisting

- Known scam wallet addresses maintained in a blocklist
- Wallets associated with Tornado Cash or known mixers flagged
- Cross-reference with community-maintained blocklists
- Admin can manually blacklist with reason

### Arbitrator Conflict of Interest

Before assigning an arbitrator, the system checks:

1. Arbitrator is NOT the buyer or seller
2. Arbitrator has not traded with buyer or seller in the last 30 days
3. Arbitrator has not resolved a dispute involving either party in the last 7 days
4. If all active arbitrators have conflicts, escalate to admin

---

## Frontend Security

### Wallet Connection

- Only connect to verified wallet providers via RainbowKit
- Display connected wallet address prominently
- Auto-disconnect on account change
- Clear encryption keys from memory on disconnect

### Client-Side Encryption

- All encryption happens in the browser using `tweetnacl-js`
- Secret keys exist only in JavaScript memory (not localStorage)
- Keys cleared on page unload, wallet disconnect, or tab close
- No secret material in URL parameters or browser history

### Content Security

- No `dangerouslySetInnerHTML` — all user content rendered as text
- Product descriptions sanitized before display
- IPFS content treated as untrusted
- External links open in new tab with `rel="noopener noreferrer"`

### Dependencies

- Minimal dependency tree to reduce supply chain attack surface
- `npm audit` run on every CI build
- Lock files committed and verified
- No CDN-hosted scripts — all dependencies bundled

---

## Infrastructure Security

### Network

- All traffic over HTTPS (TLS 1.3)
- Cloudflare for DDoS protection and WAF
- API server not directly exposed to internet
- Database accessible only from backend network
- Redis accessible only from backend network

### Database

- Encryption at rest (PostgreSQL TDE or disk encryption)
- Regular automated backups (encrypted)
- Point-in-time recovery enabled
- No direct database access — all queries through ORM
- Connection pooling with pgBouncer

### Secrets Management

- Environment variables for secrets (never in code)
- `.env` files never committed to git
- Production secrets via cloud provider secret manager
- Private keys for deployment stored in hardware wallet or KMS
- JWT secret rotated monthly

### Monitoring

- Uptime monitoring for all services
- Alert on unusual patterns (spike in disputes, large withdrawals)
- Smart contract event monitoring for unexpected behavior
- Error rate monitoring with alerting threshold

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|------------|--------------|---------|
| P0 - Critical | Funds at risk, contract exploit | Immediate | Reentrancy attack detected |
| P1 - High | Service down, data breach | < 1 hour | Database compromised |
| P2 - Medium | Degraded service, fraud detected | < 4 hours | Rate limiting bypassed |
| P3 - Low | Minor bug, UI issue | < 24 hours | Display error |

### P0 Response Procedure

1. **Pause** smart contracts immediately (`pause()`)
2. **Assess** scope of the vulnerability
3. **Communicate** to users via status page
4. **Fix** or deploy patched contracts
5. **Verify** fix with audit
6. **Resume** operations (`unpause()`)
7. **Post-mortem** within 48 hours

### Contact

Security issues should be reported to the team via encrypted channels. Do not disclose vulnerabilities publicly before they are patched.
