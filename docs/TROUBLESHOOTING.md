# Troubleshooting Guide

Common issues, error diagnosis, and solutions for P2P Escrow Privacy Marketplace.

## Table of Contents

- [Diagnostic Commands](#diagnostic-commands)
- [Backend Issues](#backend-issues)
  - [API won't start](#api-wont-start)
  - [Database connection errors](#database-connection-errors)
  - [Redis connection errors](#redis-connection-errors)
  - [Alembic migration failures](#alembic-migration-failures)
  - [Celery workers not processing tasks](#celery-workers-not-processing-tasks)
  - [Blockchain event sync is behind / stuck](#blockchain-event-sync-is-behind--stuck)
  - [RPC endpoint errors](#rpc-endpoint-errors)
  - [JWT authentication failures](#jwt-authentication-failures)
  - [Rate limiting issues](#rate-limiting-issues)
  - [IPFS upload failures](#ipfs-upload-failures)
  - [WebSocket connections dropping](#websocket-connections-dropping)
- [Frontend Issues](#frontend-issues)
  - [Wallet won't connect](#wallet-wont-connect)
  - [Transaction rejected / reverted](#transaction-rejected--reverted)
  - [Encryption / decryption failures](#encryption--decryption-failures)
  - [Messages not decrypting](#messages-not-decrypting)
  - [Product key decryption fails after purchase](#product-key-decryption-fails-after-purchase)
  - [WebSocket not receiving updates](#websocket-not-receiving-updates)
  - [CORS errors in browser console](#cors-errors-in-browser-console)
  - [Hydration errors (Next.js)](#hydration-errors-nextjs)
- [Smart Contract Issues](#smart-contract-issues)
  - [Transaction out of gas](#transaction-out-of-gas)
  - [Order stuck in wrong state](#order-stuck-in-wrong-state)
  - [Auto-expire / auto-release not triggering](#auto-expire--auto-release-not-triggering)
  - [Dispute assignment fails (no arbitrator available)](#dispute-assignment-fails-no-arbitrator-available)
  - [Contract is paused](#contract-is-paused)
- [Infrastructure Issues](#infrastructure-issues)
  - [Docker containers restart looping](#docker-containers-restart-looping)
  - [Nginx 502 Bad Gateway](#nginx-502-bad-gateway)
  - [SSL certificate errors](#ssl-certificate-errors)
  - [High memory usage](#high-memory-usage)
  - [Disk space running low](#disk-space-running-low)
- [Data Consistency Issues](#data-consistency-issues)
  - [Database and blockchain state mismatch](#database-and-blockchain-state-mismatch)
  - [Duplicate order records](#duplicate-order-records)
  - [Missing order after on-chain transaction](#missing-order-after-on-chain-transaction)
- [API Error Code Reference](#api-error-code-reference)

---

## Diagnostic Commands

Quick commands to assess the overall system health:

```bash
# ── Service status ──────────────────────────
docker compose ps                                    # All container statuses
docker compose logs --since 10m api                  # Recent API logs
docker compose logs --since 10m celery-events        # Recent event listener logs

# ── Health checks ───────────────────────────
curl -sf https://api.yourdomain.com/health           # API health endpoint
docker compose exec postgres pg_isready              # PostgreSQL
docker compose exec redis redis-cli -a $REDIS_PASSWORD ping  # Redis

# ── Database ────────────────────────────────
docker compose exec api alembic current              # Current migration revision
docker compose exec postgres psql -U p2p_user -d p2p_escrow \
  -c "SELECT COUNT(*) FROM orders WHERE status = 'created';"

# ── Celery ──────────────────────────────────
docker compose exec celery-events \
  celery -A app.workers inspect active               # Active tasks
docker compose exec celery-events \
  celery -A app.workers inspect reserved             # Queued tasks
docker compose exec celery-events \
  celery -A app.workers inspect stats                # Worker stats

# ── Blockchain sync cursor ──────────────────
docker compose exec postgres psql -U p2p_user -d p2p_escrow \
  -c "SELECT * FROM event_sync_cursor;"

# ── Redis state ─────────────────────────────
docker compose exec redis redis-cli -a $REDIS_PASSWORD info memory
docker compose exec redis redis-cli -a $REDIS_PASSWORD dbsize
```

---

## Backend Issues

### API won't start

**Symptoms**: Container exits immediately, `uvicorn` crashes, health endpoint returns nothing.

**Check logs first:**

```bash
docker compose logs api --tail 50
```

| Log message | Cause | Solution |
|-------------|-------|----------|
| `ValidationError: field required` | Missing env var | Check `.env` against [ENV-REFERENCE.md](ENV-REFERENCE.md). Run with `APP_DEBUG=true` to see which var. |
| `ModuleNotFoundError: No module named 'xxx'` | Missing dependency | `docker compose exec api pip install -r requirements.txt` or rebuild image. |
| `Address already in use :8000` | Port conflict | Another process on 8000. Kill it: `lsof -ti:8000 \| xargs kill` or change `APP_PORT`. |
| `Connection refused` (on startup) | Database or Redis not ready | Ensure depends_on health checks are configured. Check `postgres` and `redis` containers. |
| `FATAL: password authentication failed` | Wrong DB credentials | Verify `DATABASE_URL` password matches the one set in PostgreSQL. |

**General fix**: If the container restarts endlessly, run it interactively to see the full error:

```bash
docker compose run --rm api bash
# Inside container:
python -c "from app.core.config import settings; print(settings)"
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

### Database connection errors

**Symptoms**: `sqlalchemy.exc.OperationalError`, `Connection refused`, `too many clients`.

| Error | Cause | Solution |
|-------|-------|----------|
| `could not connect to server: Connection refused` | PostgreSQL is down or unreachable | Check `docker compose ps postgres`. Verify host/port in `DATABASE_URL`. |
| `password authentication failed for user` | Wrong credentials | Verify username/password in `DATABASE_URL`. Reset with `ALTER USER p2p_user PASSWORD 'new';` |
| `FATAL: too many connections for role` | Connection pool exhaustion | Reduce `DATABASE_POOL_SIZE` or increase PostgreSQL `max_connections`. Check for connection leaks. |
| `remaining connection slots are reserved` | PostgreSQL at max | `SELECT count(*) FROM pg_stat_activity;` to check. Kill idle connections or increase `max_connections`. |
| `SSL connection has been closed unexpectedly` | Connection dropped | Enable `pool_pre_ping=True` in SQLAlchemy engine (verifies connections before use). |
| `relation "xxx" does not exist` | Migrations not applied | Run `alembic upgrade head`. |

**Kill idle connections:**

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'p2p_escrow'
  AND state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes';
```

---

### Redis connection errors

**Symptoms**: `ConnectionError`, `NOAUTH`, auth failures, cached data missing.

| Error | Cause | Solution |
|-------|-------|----------|
| `NOAUTH Authentication required` | Password not in `REDIS_URL` | Format: `redis://:PASSWORD@host:6379/0` (note the colon before password). |
| `Connection refused` | Redis not running | `docker compose ps redis`. Check `bind` address in redis.conf. |
| `OOM command not allowed` | Redis out of memory | Check `maxmemory` setting. Review eviction policy (`allkeys-lru` recommended). |
| Cache misses but Redis is running | Wrong `REDIS_CACHE_DB` | Verify `REDIS_CACHE_DB` matches the DB number in `REDIS_URL`. |

**Flush Redis cache (if stale data suspected):**

```bash
# Flush only the cache DB (not Celery DB)
docker compose exec redis redis-cli -a $REDIS_PASSWORD -n 0 FLUSHDB

# Check memory usage
docker compose exec redis redis-cli -a $REDIS_PASSWORD info memory
```

---

### Alembic migration failures

**Symptoms**: `alembic upgrade head` fails, app crashes with "table not found".

| Error | Cause | Solution |
|-------|-------|----------|
| `Target database is not up to date` | Pending migrations | Run `alembic upgrade head`. |
| `Can't locate revision identified by 'xxx'` | Missing migration file | Migration file was deleted. Stamp to current: `alembic stamp head`. |
| `duplicate column name` | Migration already partially applied | Check `alembic current`, then `alembic stamp <correct_revision>`. |
| `Revision xxx is not a direct ancestor of yyy` | Branch conflict | `alembic merge heads -m "merge"` to resolve branch. |
| Lock timeout during migration | Long-running queries blocking DDL | Run migration during low-traffic period. Kill blocking queries first. |

**Emergency: Reset migration state (dangerous):**

```bash
# Check what Alembic thinks is current
alembic current

# Force-stamp to a known revision (does NOT change the database)
alembic stamp <revision_id>

# If completely out of sync, stamp to head (assumes schema is already correct)
alembic stamp head
```

---

### Celery workers not processing tasks

**Symptoms**: Orders not syncing from blockchain, timeouts not firing, WebSocket notifications silent.

**Diagnosis:**

```bash
# Check worker status
docker compose exec celery-events celery -A app.workers inspect active

# Check if tasks are queued but not consumed
docker compose exec redis redis-cli -a $REDIS_PASSWORD LLEN celery

# Check worker logs
docker compose logs celery-events --tail 100
docker compose logs celery-beat --tail 50
```

| Symptom | Cause | Solution |
|---------|-------|----------|
| Workers show 0 active tasks | Worker not connected to broker | Verify `CELERY_BROKER_URL`. Check Redis connectivity. |
| Tasks queued but not consumed | Workers crashed or wrong queue | Check queue names match: `-Q events` for event listener, `-Q timeouts` for timeout checker. |
| Beat not scheduling tasks | celery-beat not running | `docker compose ps celery-beat`. Restart: `docker compose restart celery-beat`. |
| `TaskRevokedError` | Task exceeded time limit | Increase `CELERY_TASK_SOFT_TIME_LIMIT` / `CELERY_TASK_HARD_TIME_LIMIT`. |
| Worker OOM killed | Not enough memory | Reduce concurrency (`-c 2`) or increase container memory limit. |

**Restart all workers:**

```bash
docker compose restart celery-events celery-timeouts celery-beat
```

---

### Blockchain event sync is behind / stuck

**Symptoms**: Orders created on-chain but not appearing in the app. Database shows old `last_block` in `event_sync_cursor`.

**Diagnosis:**

```bash
# Check sync cursor
docker compose exec postgres psql -U p2p_user -d p2p_escrow \
  -c "SELECT chain, last_block, updated_at FROM event_sync_cursor;"

# Compare with current block
cast block-number --rpc-url $BSC_RPC_URL
```

| Symptom | Cause | Solution |
|---------|-------|----------|
| `last_block` far behind current | Worker was down or RPC was unreachable | Restart `celery-events`. It will catch up from `last_block`. |
| `last_block` not updating at all | Worker crashed in loop | Check `celery-events` logs. Restart worker. |
| Events processed but orders not in DB | Database write failure | Check PostgreSQL connectivity from worker. Review error logs. |
| Duplicate events being processed | Worker restarted mid-batch | Safe — `UNIQUE(chain, onchain_order_id)` prevents duplicates. Errors logged but harmless. |

**Manual re-sync from a specific block:**

```sql
-- Reset cursor to re-process from block 40000000
UPDATE event_sync_cursor
SET last_block = 40000000, updated_at = NOW()
WHERE chain = 'bsc';
```

Then restart the event listener worker.

---

### RPC endpoint errors

**Symptoms**: `ConnectionError`, `429 Too Many Requests`, stale blockchain data.

| Error | Cause | Solution |
|-------|-------|----------|
| `429 Too Many Requests` | RPC rate limit exceeded | Use a paid RPC plan. Add `*_RPC_FALLBACK` URL. Increase `CELERY_EVENT_LISTENER_POLL_INTERVAL`. |
| `ConnectionError` / timeout | RPC node down | Fallback URL should auto-activate. If both fail, switch provider. |
| `block not found` | Querying too recent a block | Wait for `*_BLOCK_CONFIRMATIONS` blocks. The system should handle this automatically. |
| Stale data / wrong chain ID | Wrong `*_RPC_URL` configured | Verify RPC URL matches the intended network. Check `*_CHAIN_ID`. |

**Test RPC connectivity:**

```bash
# Check latest block number
cast block-number --rpc-url $BSC_RPC_URL

# Check chain ID
cast chain-id --rpc-url $BSC_RPC_URL

# Test contract read
cast call $BSC_ESCROW_CONTRACT "paused()" --rpc-url $BSC_RPC_URL
```

---

### JWT authentication failures

**Symptoms**: Users get logged out, `401 UNAUTHORIZED` on every request.

| Error | Cause | Solution |
|-------|-------|----------|
| `UNAUTHORIZED` on all requests | `JWT_SECRET` changed | Rotating the secret invalidates all tokens. Users must re-authenticate. |
| `NONCE_EXPIRED` on login | > 5 min between nonce request and signing | User must complete sign-in within 5 minutes. Check `AUTH_NONCE_TTL`. |
| `INVALID_SIGNATURE` on login | Wrong network in wallet | Ensure wallet is on the correct chain. Signature is chain-agnostic but wallet UI may confuse users. |
| Token valid but user not found | User profile deleted or DB reset | User must re-authenticate to recreate profile. |

---

### Rate limiting issues

**Symptoms**: `429 RATE_LIMITED` errors, legitimate users blocked.

**Check current rate limit state:**

```bash
# Check a specific wallet's rate limit counter
docker compose exec redis redis-cli -a $REDIS_PASSWORD \
  GET "rate:0xWalletAddress:global"
```

| Symptom | Cause | Solution |
|---------|-------|----------|
| Legitimate user rate limited | Too many rapid requests (scripts, page reloads) | Increase `RATE_LIMIT_GLOBAL` or add exponential backoff on frontend. |
| All users rate limited | Redis counter not expiring | Check Redis TTLs. Flush rate limit keys: `redis-cli KEYS "rate:*" \| xargs redis-cli DEL`. |
| Rate limit bypass | Missing rate limit middleware | Verify middleware is registered in FastAPI app. |

---

### IPFS upload failures

**Symptoms**: Evidence upload fails, `500` on dispute creation.

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` from Pinata | Invalid API key | Verify `PINATA_API_KEY` and `PINATA_SECRET_KEY`. Regenerate on Pinata dashboard. |
| `413 Payload Too Large` | File exceeds Pinata limit | Check `PINATA_MAX_FILE_SIZE`. Pinata free tier: 100 MB per file. |
| Timeout on upload | Large file or slow connection | Increase request timeout. Consider compressing evidence before upload. |
| IPFS content not accessible | Pin not replicated yet | Wait 1-2 minutes. Check pin status on Pinata dashboard. |

---

### WebSocket connections dropping

**Symptoms**: Real-time notifications stop, order status doesn't update live.

| Symptom | Cause | Solution |
|---------|-------|----------|
| Disconnects after 60s | Nginx proxy timeout | Set `proxy_read_timeout 86400;` in Nginx WebSocket location block. |
| Disconnects intermittently | Cloudflare timeout (100s idle) | Implement ping/pong heartbeat every 30s on the client. |
| Connection refused | WebSocket route not configured in Nginx | Ensure `proxy_http_version 1.1` and `Upgrade`/`Connection` headers set. See [DEPLOYMENT.md](DEPLOYMENT.md#6-ssltls--domain-setup). |
| Connected but no events | Redis pub/sub broken | Restart Redis or check `REDIS_URL` on the API server. |

---

## Frontend Issues

### Wallet won't connect

**Symptoms**: RainbowKit modal doesn't appear, connection hangs, wrong network.

| Symptom | Cause | Solution |
|---------|-------|----------|
| Modal doesn't open | WalletConnect project ID invalid | Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. Create new project at cloud.walletconnect.com. |
| "Chain not supported" | Wallet on wrong network | App should prompt chain switch. Check wagmi config includes the target chain. |
| MetaMask shows error | BSC not added to MetaMask | User must add BSC network manually or app should trigger `wallet_addEthereumChain`. |
| Connection works but auth fails | Public key not derived | Ensure `useEncryption` hook runs after wallet connection to derive NaCl keypair. |

---

### Transaction rejected / reverted

**Symptoms**: MetaMask shows "transaction reverted", on-chain call fails.

| Revert reason | Cause | Solution |
|---------------|-------|----------|
| `ERC20: insufficient allowance` | Token not approved for escrow contract | Frontend must call `approve()` before `createOrder()`. Check approval amount. |
| `Unsupported token` | Token address not in `supportedTokens` | Verify token is enabled on-chain: `cast call $ESCROW "supportedTokens(address)" $TOKEN`. |
| `Amount too low` | Below `MIN_ORDER_AMOUNT` (1 USDT) | Enforce minimum in frontend UI. |
| `Invalid status transition` | Order not in expected state | UI may be stale — refresh order status before actions. |
| `Not buyer` / `Not seller` | Wrong wallet calling function | User switched wallet accounts. Reconnect with correct wallet. |
| `Pausable: paused` | Contract emergency paused | Check with admin. Likely an ongoing incident. |
| Out of gas | Gas limit too low | Increase gas limit. See [gas estimates](SMART-CONTRACT.md#gas-estimates). |
| `execution reverted` (no reason) | Insufficient token balance | Check user's USDT/USDC balance. Must cover `amount + 2% fee`. |

**Debug a reverted transaction:**

```bash
# Get revert reason from tx hash
cast run $TX_HASH --rpc-url $BSC_RPC_URL

# Or decode from receipt
cast receipt $TX_HASH --rpc-url $BSC_RPC_URL
```

---

### Encryption / decryption failures

**Symptoms**: "Decryption failed" error, garbled message content, `null` returned from `nacl.box.open`.

| Symptom | Cause | Solution |
|---------|-------|----------|
| `nacl.box.open` returns null | Wrong keypair used | User likely switched wallets. Must use the same wallet that was connected during encryption. |
| "Decryption failed" after clearing browser | Keys not in memory | Keys are cleared on page unload. Re-authenticate to re-derive keypair. |
| Messages from before re-auth unreadable | Different auth message signed | Key derivation is deterministic from the same message. Ensure `AUTH_MESSAGE_PREFIX` hasn't changed. |
| Garbled output after decryption | Encoding mismatch | Ensure base64 encode/decode is consistent. Check nonce is passed correctly. |

**Key recovery flow:**

1. User connects the same wallet
2. Signs the auth message (same format: `P2P-Auth-{timestamp}-{nonce}`)
3. `keccak256(signature)` produces the same seed → same NaCl keypair
4. Previous messages become readable again

> **Critical**: If `AUTH_MESSAGE_PREFIX` changes in backend config, all existing users lose access to their encrypted data. Never change this in production.

---

### Messages not decrypting

**Symptoms**: Chat shows ciphertext or "[Decryption failed]", messages from counterparty unreadable.

**Checklist:**

1. Is the user using the same wallet that was connected when messages were sent?
2. Did the user re-authenticate after clearing browser data?
3. Does the counterparty's `public_key` in `user_profiles` match their current NaCl keypair?
4. Is the nonce being correctly paired with the ciphertext?

```
Common fix: User disconnects wallet → reconnects → signs auth message → keys re-derived → retry.
```

If the sender's public key was updated (re-registered with different auth message), old messages encrypted with the previous keypair are permanently unreadable.

---

### Product key decryption fails after purchase

**Symptoms**: Buyer received delivery but cannot decrypt the product key.

| Cause | Solution |
|-------|----------|
| Seller encrypted with wrong buyer public key | Seller should re-deliver using `POST /orders/:id/deliver` with correct encryption. |
| Buyer's public key changed between order creation and delivery | Buyer must re-connect the same wallet used at purchase time. |
| Encoding error in `product_key_encrypted` | Seller's frontend may have a bug. Check base64 encoding of ciphertext and nonce. |

**If unresolvable**: Buyer should open a dispute (`openDispute()`) and provide evidence that decryption failed.

---

### WebSocket not receiving updates

**Symptoms**: Order status doesn't update live, must refresh page.

**Checklist:**

1. Check browser DevTools → Network → WS tab. Is the connection established?
2. Look for `101 Switching Protocols` response.
3. If connection rejected, check JWT token in query param.
4. If connected but no messages, check backend Celery workers are running (they push events via Redis pub/sub → WebSocket).

| Symptom | Cause | Solution |
|---------|-------|----------|
| `403` on WS connect | JWT expired or missing | Re-authenticate to get a fresh token. |
| `404` on WS connect | Wrong URL path | Verify `NEXT_PUBLIC_WS_URL`. Path: `/ws/orders/{id}?token={jwt}`. |
| Connected, no events | Celery not publishing to Redis | Check `celery-events` worker is running. |

---

### CORS errors in browser console

**Symptoms**: `Access-Control-Allow-Origin` error, API calls blocked.

| Symptom | Cause | Solution |
|---------|-------|----------|
| `No 'Access-Control-Allow-Origin' header` | Frontend origin not in `CORS_ORIGINS` | Add the exact origin (including protocol and port) to `CORS_ORIGINS` in backend `.env`. |
| CORS error only on `POST` / `PUT` | Preflight `OPTIONS` request blocked | Ensure FastAPI CORS middleware allows `OPTIONS` method. |
| Works locally but not in production | Different domains | `http://localhost:3000` != `https://yourdomain.com`. Add the production origin. |
| CORS error after Cloudflare setup | Cloudflare stripping headers | Check Cloudflare → Rules → Transform Rules. Ensure CORS headers are not modified. |

---

### Hydration errors (Next.js)

**Symptoms**: "Text content does not match server-rendered HTML", UI flickers.

| Cause | Solution |
|-------|----------|
| Wallet state only available client-side | Wrap wallet-dependent UI in `useEffect` or use `dynamic(() => import(...), { ssr: false })`. |
| Timestamp formatting differs server/client | Use `suppressHydrationWarning` on time elements or format consistently. |
| Browser extension injecting content | Usually harmless. Ignore if only in development. |

---

## Smart Contract Issues

### Transaction out of gas

**Symptoms**: Transaction fails with "out of gas" error.

**Gas estimates** (from [SMART-CONTRACT.md](SMART-CONTRACT.md#gas-estimates)):

| Function | Estimated Gas | Recommended Limit |
|----------|-------------|-------------------|
| `createOrder` | ~150,000 | 200,000 |
| `sellerConfirmDelivery` | ~50,000 | 80,000 |
| `buyerConfirmReceived` | ~80,000 | 120,000 |
| `openDispute` | ~100,000 | 150,000 |
| `resolveDispute` | ~120,000 | 180,000 |

**Fix**: Set gas limit to 1.5x the estimate in frontend contract calls. MetaMask usually estimates correctly, but wallets sometimes underestimate for complex contract interactions.

---

### Order stuck in wrong state

**Symptoms**: Order shows a state in the app that doesn't match on-chain state.

**Diagnosis:**

```bash
# Check on-chain state
cast call $BSC_ESCROW_CONTRACT \
  "orders(uint256)" $ONCHAIN_ORDER_ID \
  --rpc-url $BSC_RPC_URL

# Check database state
docker compose exec postgres psql -U p2p_user -d p2p_escrow \
  -c "SELECT id, onchain_order_id, status, updated_at FROM orders WHERE onchain_order_id = $ONCHAIN_ORDER_ID AND chain = 'bsc';"
```

| Scenario | Cause | Solution |
|----------|-------|----------|
| On-chain: `Completed`, DB: `seller_confirmed` | Event listener missed the event | Re-sync: update `event_sync_cursor.last_block` to before the missed event. |
| On-chain: `Created`, DB: `expired` | DB auto-expired but on-chain hasn't | Call `autoExpireOrder()` on-chain to sync, or the on-chain state is correct and DB needs correction. |
| DB has no record | Event listener was down when order was created | Re-sync from the block where the order was created. |

**Manual state correction (use with caution):**

```sql
-- Only if you've verified the on-chain state
UPDATE orders
SET status = 'completed', updated_at = NOW()
WHERE onchain_order_id = 42 AND chain = 'bsc';
```

---

### Auto-expire / auto-release not triggering

**Symptoms**: Orders past timeout window remain in `created` or `seller_confirmed` state.

**Checklist:**

1. Is `celery-beat` running? → `docker compose ps celery-beat`
2. Is `celery-timeouts` worker running? → `docker compose ps celery-timeouts`
3. Check `CELERY_TIMEOUT_CHECK_INTERVAL` — default is 60 seconds
4. Check Celery beat logs: `docker compose logs celery-beat --tail 50`
5. The on-chain `autoExpireOrder()` / `autoReleaseToSeller()` must also be called

**Flow**: Celery beat schedules periodic timeout check → timeout worker scans DB for expired orders → calls on-chain auto-expire/auto-release functions → event listener picks up the event → updates DB.

If the backend timeout worker is running but on-chain calls fail, check:
- Is the backend wallet (caller) funded with enough BNB/ETH for gas?
- Is the contract paused?

---

### Dispute assignment fails (no arbitrator available)

**Symptoms**: `openDispute()` reverts or no arbitrator assigned.

| Cause | Solution |
|-------|----------|
| No active arbitrators in pool | Need arbitrators to register and stake. |
| All arbitrators have conflicts | All active arbitrators traded with buyer or seller recently. Wait 30 days or add new arbitrators. |
| ArbitratorPool contract not linked | Verify `arbitratorPool()` on Escrow contract: `cast call $ESCROW "arbitratorPool()"`. |

---

### Contract is paused

**Symptoms**: All state-changing transactions revert with `Pausable: paused`.

**Check:**

```bash
cast call $BSC_ESCROW_CONTRACT "paused()" --rpc-url $BSC_RPC_URL
# Returns: true (0x01) or false (0x00)
```

**Unpause** (owner only):

```bash
cast send $BSC_ESCROW_CONTRACT "unpause()" \
  --rpc-url $BSC_RPC_URL \
  --private-key $OWNER_KEY
```

> Contracts should only be paused during P0 incidents. See [SECURITY.md — Incident Response](SECURITY.md#incident-response).

---

## Infrastructure Issues

### Docker containers restart looping

**Symptoms**: Container status shows `Restarting`, uptime resets every few seconds.

```bash
# Check restart count and last exit code
docker compose ps
docker inspect --format='{{.RestartCount}} {{.State.ExitCode}}' p2p-api
```

| Exit code | Meaning | Solution |
|-----------|---------|----------|
| 0 | Clean exit (unexpected for long-running service) | Check if CMD is correct in Dockerfile. |
| 1 | Application error | Check logs: `docker compose logs api --tail 100`. |
| 137 | OOM killed (SIGKILL) | Increase container memory limit or reduce `APP_WORKERS`. |
| 139 | Segfault | Likely a native library issue. Rebuild image. |

---

### Nginx 502 Bad Gateway

**Symptoms**: Users see "502 Bad Gateway" error page.

| Cause | Solution |
|-------|----------|
| Backend not running | `docker compose ps api`. Restart if needed. |
| Backend on wrong port | Verify `APP_PORT` matches Nginx upstream config. |
| Backend overloaded | Check CPU/memory. Scale workers: `docker compose up -d --scale api=2`. |
| Nginx can't resolve upstream | If using Docker, use container name (e.g., `api:8000`), not `localhost`. |

**Test Nginx → Backend connectivity:**

```bash
# From inside Nginx container
docker compose exec nginx curl -f http://api:8000/health
```

---

### SSL certificate errors

**Symptoms**: Browser shows "connection not secure", `ERR_CERT_DATE_INVALID`.

| Symptom | Cause | Solution |
|---------|-------|----------|
| Certificate expired | Certbot auto-renew failed | `sudo certbot renew`. Check cron: `systemctl status certbot.timer`. |
| "Not secure" despite valid cert | Mixed content (HTTP resources on HTTPS page) | Ensure all API calls use `https://`. Check `NEXT_PUBLIC_API_URL`. |
| Cloudflare SSL error 525/526 | Origin cert mismatch | Set Cloudflare SSL mode to **Full (strict)**. Ensure origin has valid cert. |

---

### High memory usage

**Symptoms**: OOM kills, slow responses, swap usage.

**Diagnosis:**

```bash
docker stats --no-stream
```

| Service | Expected memory | If excessive |
|---------|----------------|-------------|
| PostgreSQL | 2-4 GB | Reduce `shared_buffers`, check for bloated tables. |
| Redis | < 1 GB | Check `maxmemory`. Flush stale keys. |
| API (per worker) | 100-200 MB | Reduce `APP_WORKERS`. Check for memory leaks (large query results held in memory). |
| Celery worker | 100-300 MB | Reduce concurrency (`-c 2`). Add `--max-memory-per-child=200000` to auto-restart leaky workers. |
| Frontend (Next.js) | 100-200 MB | Normal for Node.js. Increase if ISR causes spikes. |

---

### Disk space running low

**Symptoms**: Database write failures, Docker build failures, log rotation stopped.

```bash
df -h
du -sh /var/lib/docker/
du -sh /var/lib/postgresql/
```

**Common culprits and fixes:**

```bash
# Docker: Remove unused images and volumes
docker system prune -a --volumes

# PostgreSQL: Check table sizes
docker compose exec postgres psql -U p2p_user -d p2p_escrow \
  -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text)) AS size
      FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename::text) DESC;"

# Logs: Truncate old Docker logs
truncate -s 0 $(docker inspect --format='{{.LogPath}}' p2p-api)

# Old backups
find /backups -name "*.dump.gz" -mtime +30 -delete
```

---

## Data Consistency Issues

### Database and blockchain state mismatch

The smart contract is the **source of truth**. If the database disagrees, the database is wrong.

**Diagnosis script:**

```bash
#!/bin/bash
# Compare on-chain vs DB state for a specific order
ORDER_ID=$1
CHAIN="bsc"

# On-chain state
echo "=== On-chain ==="
cast call $BSC_ESCROW_CONTRACT "orders(uint256)" $ORDER_ID --rpc-url $BSC_RPC_URL

# Database state
echo "=== Database ==="
docker compose exec postgres psql -U p2p_user -d p2p_escrow \
  -c "SELECT onchain_order_id, status, amount, buyer_wallet, seller_wallet, updated_at
      FROM orders WHERE onchain_order_id = $ORDER_ID AND chain = '$CHAIN';"
```

**Resolution**: Re-sync events by resetting the event cursor to before the mismatched order's creation block, then restart the event listener worker.

---

### Duplicate order records

**Symptoms**: Same on-chain order appears multiple times in the database.

This shouldn't happen due to the `UNIQUE(chain, onchain_order_id)` constraint. If it does:

```sql
-- Find duplicates
SELECT chain, onchain_order_id, COUNT(*)
FROM orders
GROUP BY chain, onchain_order_id
HAVING COUNT(*) > 1;

-- Keep the most recently updated record, delete others
DELETE FROM orders a
USING orders b
WHERE a.chain = b.chain
  AND a.onchain_order_id = b.onchain_order_id
  AND a.updated_at < b.updated_at;
```

---

### Missing order after on-chain transaction

**Symptoms**: Transaction confirmed on block explorer, but order not in the app.

**Checklist:**

1. Wait for required block confirmations (BSC: 15 blocks ≈ 45s)
2. Check if the event listener has reached the block: `SELECT * FROM event_sync_cursor WHERE chain = 'bsc';`
3. Check Celery event listener logs for errors
4. Verify the transaction actually emitted `OrderCreated` event on the block explorer

**If the event was missed**, reset the sync cursor to the block **before** the transaction:

```sql
UPDATE event_sync_cursor
SET last_block = <tx_block_number - 1>, updated_at = NOW()
WHERE chain = 'bsc';
```

Then restart: `docker compose restart celery-events`.

---

## API Error Code Reference

Quick reference for API error codes and how to resolve them.

| Code | HTTP | Meaning | User Action |
|------|------|---------|-------------|
| `UNAUTHORIZED` | 401 | JWT missing or expired | Re-connect wallet and sign in again. |
| `FORBIDDEN` | 403 | Not authorized for this action | Verify you're using the correct wallet (buyer vs seller). |
| `NOT_FOUND` | 404 | Resource doesn't exist | Check the ID. Order may not be synced yet — wait and retry. |
| `VALIDATION_ERROR` | 422 | Invalid request data | Check request body matches the [API spec](API.md). |
| `RATE_LIMITED` | 429 | Too many requests | Wait for `X-RateLimit-Reset` timestamp, then retry. |
| `INVALID_SIGNATURE` | 401 | Wallet signature doesn't match | Ensure wallet is unlocked and signing with the correct account. |
| `NONCE_EXPIRED` | 401 | Auth nonce expired (5 min TTL) | Request a new nonce and sign within 5 minutes. |
| `ORDER_NOT_CANCELLABLE` | 400 | Seller already confirmed delivery | Can't cancel after delivery. Open a dispute instead. |
| `NOT_BUYER` | 403 | Only buyer can perform this action | Switch to the buyer's wallet. |
| `NOT_SELLER` | 403 | Only seller can perform this action | Switch to the seller's wallet. |
| `NOT_ARBITRATOR` | 403 | Only assigned arbitrator can act | Only the assigned arbitrator can resolve this dispute. |
| `DISPUTE_ALREADY_OPEN` | 400 | Active dispute exists | Wait for the current dispute to be resolved. |
| `ORDER_EXPIRED` | 400 | Order timed out | Create a new order. |
| `CHAIN_MISMATCH` | 400 | Transaction on wrong chain | Switch wallet to the correct chain before submitting. |
| `TX_NOT_CONFIRMED` | 400 | Transaction not yet confirmed | Wait for required block confirmations and retry. |
| `SELLER_LIMIT_EXCEEDED` | 400 | New seller limit reached | New sellers: max 3 orders/day, max 50 USDT. Wait or complete more trades. |
| `INTERNAL_ERROR` | 500 | Server error | Retry after a moment. If persistent, check backend logs. |
