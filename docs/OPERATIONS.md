# Operations Guide

Day-to-day operations, monitoring, log management, runbooks, and on-call procedures for P2P Escrow Privacy Marketplace.

## Table of Contents

- [Operational Overview](#operational-overview)
- [1. Service Map & Dependencies](#1-service-map--dependencies)
- [2. Health Monitoring](#2-health-monitoring)
  - [Health Endpoint](#health-endpoint)
  - [Uptime Monitoring](#uptime-monitoring)
  - [Prometheus Metrics](#prometheus-metrics)
  - [Alert Thresholds](#alert-thresholds)
  - [Alerting Channels](#alerting-channels)
- [3. Log Management](#3-log-management)
  - [Log Format](#log-format)
  - [Log Collection](#log-collection)
  - [Useful Log Queries](#useful-log-queries)
  - [Log Retention](#log-retention)
- [4. Daily Operations Checklist](#4-daily-operations-checklist)
- [5. Scheduled Tasks](#5-scheduled-tasks)
- [6. Runbooks](#6-runbooks)
  - [RB-01: API Unresponsive](#rb-01-api-unresponsive)
  - [RB-02: Database Connection Exhaustion](#rb-02-database-connection-exhaustion)
  - [RB-03: Blockchain Event Sync Lag](#rb-03-blockchain-event-sync-lag)
  - [RB-04: High Dispute Rate](#rb-04-high-dispute-rate)
  - [RB-05: Smart Contract Emergency Pause](#rb-05-smart-contract-emergency-pause)
  - [RB-06: JWT Secret Rotation](#rb-06-jwt-secret-rotation)
  - [RB-07: RPC Provider Failover](#rb-07-rpc-provider-failover)
  - [RB-08: Redis Memory Pressure](#rb-08-redis-memory-pressure)
  - [RB-09: Celery Queue Backlog](#rb-09-celery-queue-backlog)
  - [RB-10: DDoS / Traffic Spike](#rb-10-ddos--traffic-spike)
- [7. Incident Management](#7-incident-management)
  - [Severity Levels](#severity-levels)
  - [Incident Lifecycle](#incident-lifecycle)
  - [Post-Mortem Template](#post-mortem-template)
- [8. On-Chain Operations](#8-on-chain-operations)
  - [Contract Read Commands](#contract-read-commands)
  - [Contract Admin Actions](#contract-admin-actions)
  - [Treasury Management](#treasury-management)
  - [Arbitrator Pool Monitoring](#arbitrator-pool-monitoring)
- [9. Business Metrics Dashboard](#9-business-metrics-dashboard)
- [10. Capacity Planning](#10-capacity-planning)
- [11. Rotation & Secret Management](#11-rotation--secret-management)

---

## Operational Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        OPERATIONS SCOPE                              │
│                                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │Monitoring│──>│ Alerting │──>│ Runbooks │──>│ Incident Mgmt   │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────────┘ │
│       │                                              │               │
│       ▼                                              ▼               │
│  ┌──────────┐                                 ┌─────────────┐       │
│  │  Logs    │                                 │ Post-Mortem │       │
│  └──────────┘                                 └─────────────┘       │
│                                                                      │
│  Daily: Health checks, log review, dispute queue                     │
│  Weekly: DB maintenance, metric review, capacity check               │
│  Monthly: Secret rotation, dependency updates, backup test           │
│  Quarterly: Full DR test, capacity planning, security review         │
└──────────────────────────────────────────────────────────────────────┘
```

**Related docs:**
- [DEPLOYMENT.md](DEPLOYMENT.md) — Initial setup, Docker Compose, infrastructure
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Diagnosing and fixing specific issues
- [DATABASE.md](DATABASE.md) — Schema, queries, DB maintenance
- [SECURITY.md](SECURITY.md) — Security practices, incident response contacts

---

## 1. Service Map & Dependencies

```
Service              │ Depends On                    │ Failure Impact
─────────────────────┼───────────────────────────────┼──────────────────────────────
Nginx                │ —                             │ All traffic blocked
Frontend (Next.js)   │ Nginx                         │ UI inaccessible
API (FastAPI)        │ PostgreSQL, Redis, Nginx       │ All API calls fail
Celery Events        │ Redis, PostgreSQL, RPC nodes   │ Blockchain sync stops
Celery Timeouts      │ Redis, PostgreSQL, RPC nodes   │ Auto-expire/release stops
Celery Beat          │ Redis                          │ Scheduled tasks stop
PostgreSQL           │ Disk, OS                       │ All writes fail, reads degrade
Redis                │ Memory, OS                     │ Cache miss, rate limit fail, WS fail
RPC Nodes (BSC)      │ External provider              │ Blockchain reads/writes fail
Pinata (IPFS)        │ External provider              │ Evidence upload fails
Cloudflare           │ External provider              │ CDN/DDoS protection lost
```

**Critical path** (if any of these fail, the platform is unusable):
`Nginx → API → PostgreSQL → RPC Nodes`

**Degraded path** (platform works with reduced functionality):
`Redis down` → cache misses, no real-time WebSocket, rate limiting disabled
`Celery down` → blockchain sync paused, timeouts don't fire (but on-chain state is still correct)
`Pinata down` → evidence upload fails (disputes delayed, core trading still works)

---

## 2. Health Monitoring

### Health Endpoint

The API exposes `/health` for monitoring:

```
GET https://api.yourdomain.com/health
```

**Response (healthy):**

```json
{
  "status": "ok",
  "version": "1.2.0",
  "uptime_seconds": 86400,
  "checks": {
    "database": { "status": "ok", "latency_ms": 2 },
    "redis": { "status": "ok", "latency_ms": 1, "memory_used_mb": 156 },
    "celery": { "status": "ok", "active_workers": 3, "queued_tasks": 5 },
    "rpc_bsc": { "status": "ok", "latest_block": 40123456, "latency_ms": 85 },
    "rpc_eth": { "status": "ok", "latest_block": 19234567, "latency_ms": 120 }
  }
}
```

**Response (degraded):**

```json
{
  "status": "degraded",
  "version": "1.2.0",
  "checks": {
    "database": { "status": "ok", "latency_ms": 3 },
    "redis": { "status": "ok", "latency_ms": 1 },
    "celery": { "status": "warning", "active_workers": 1, "queued_tasks": 250 },
    "rpc_bsc": { "status": "error", "error": "Connection timeout", "using_fallback": true }
  }
}
```

**Implementation** (`backend/app/api/health.py`):

```python
from fastapi import APIRouter
from datetime import datetime, timezone
import time, asyncio, redis.asyncio as redis
from app.core.database import engine
from app.core.config import settings

router = APIRouter()
START_TIME = time.time()

@router.get("/health")
async def health_check():
    checks = {}

    # Database
    try:
        start = time.monotonic()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok", "latency_ms": round((time.monotonic() - start) * 1000)}
    except Exception as e:
        checks["database"] = {"status": "error", "error": str(e)}

    # Redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        start = time.monotonic()
        await r.ping()
        info = await r.info("memory")
        checks["redis"] = {
            "status": "ok",
            "latency_ms": round((time.monotonic() - start) * 1000),
            "memory_used_mb": round(info["used_memory"] / 1024 / 1024),
        }
        await r.close()
    except Exception as e:
        checks["redis"] = {"status": "error", "error": str(e)}

    # Determine overall status
    statuses = [c["status"] for c in checks.values()]
    if all(s == "ok" for s in statuses):
        overall = "ok"
    elif any(s == "error" for s in statuses):
        overall = "error"
    else:
        overall = "degraded"

    return {
        "status": overall,
        "version": settings.APP_VERSION,
        "uptime_seconds": int(time.time() - START_TIME),
        "checks": checks,
    }
```

### Uptime Monitoring

Configure external monitors to ping the health endpoint:

| Monitor | URL | Interval | Alert After |
|---------|-----|----------|-------------|
| API Health | `https://api.yourdomain.com/health` | 1 min | 2 consecutive failures |
| Frontend | `https://yourdomain.com` | 1 min | 2 consecutive failures |
| WebSocket | `wss://api.yourdomain.com/ws/health` | 5 min | 1 failure |
| BSC RPC | Health endpoint `rpc_bsc` field | 1 min | 3 consecutive failures |

**Recommended services**: UptimeRobot (free, 50 monitors), Better Uptime, Pingdom.

### Prometheus Metrics

Expose metrics at `/metrics` for Prometheus scraping:

```
# API metrics
http_requests_total{method="GET", endpoint="/products", status="200"}
http_request_duration_seconds{method="GET", endpoint="/products", quantile="0.95"}
http_requests_in_progress

# Business metrics
p2p_orders_created_total{chain="bsc", token="USDT"}
p2p_orders_completed_total{chain="bsc"}
p2p_orders_disputed_total{chain="bsc"}
p2p_orders_expired_total{chain="bsc", reason="seller_timeout"}
p2p_platform_fees_collected_total{chain="bsc", token="USDT"}

# Infrastructure metrics
db_connection_pool_size
db_connection_pool_checked_out
redis_memory_used_bytes
redis_connected_clients
celery_tasks_active
celery_tasks_queued
celery_tasks_failed_total
blockchain_sync_lag_blocks{chain="bsc"}
blockchain_rpc_latency_seconds{chain="bsc", provider="primary"}
```

**Grafana dashboard panels** (recommended):

1. API request rate & latency (p50, p95, p99)
2. Error rate by endpoint
3. Order volume (created, completed, disputed per hour)
4. Blockchain sync lag per chain
5. Database connection pool utilization
6. Redis memory & hit rate
7. Celery queue depth & task throughput

### Alert Thresholds

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| API down | Health endpoint fails 2x consecutive | P1 | PagerDuty + Telegram |
| API slow | p95 latency > 2s for 5 min | P2 | Telegram |
| High error rate | 5xx rate > 5% for 5 min | P1 | PagerDuty + Telegram |
| DB connections exhausted | pool usage > 95% for 2 min | P1 | PagerDuty |
| DB connections high | pool usage > 80% for 10 min | P2 | Telegram |
| Redis OOM | memory > 90% maxmemory | P1 | PagerDuty |
| Redis high memory | memory > 70% maxmemory | P2 | Telegram |
| Blockchain sync lag | > 100 blocks behind for 5 min | P2 | Telegram |
| Blockchain sync stuck | cursor unchanged for 10 min | P1 | PagerDuty |
| Celery queue buildup | > 500 tasks queued for 5 min | P2 | Telegram |
| Celery workers down | 0 active workers for 2 min | P1 | PagerDuty |
| RPC primary down | primary unreachable, fallback active | P2 | Telegram |
| RPC both down | primary + fallback unreachable | P1 | PagerDuty |
| Disk usage | > 85% | P2 | Telegram |
| Disk critical | > 95% | P1 | PagerDuty |
| SSL cert expiry | < 7 days | P2 | Telegram |
| High dispute rate | > 20% dispute rate in 24h | P2 | Telegram (fraud alert) |
| Large withdrawal | Single order > 5,000 USDT | P3 | Telegram (info) |
| Contract paused | `paused() == true` | P0 | PagerDuty (immediate) |

### Alerting Channels

```bash
# ── Telegram Bot (lightweight alerts) ───────
# Create bot via @BotFather, get chat ID

# /opt/p2p-mmo/scripts/alert-telegram.sh
#!/bin/bash
BOT_TOKEN="your_bot_token"
CHAT_ID="your_chat_id"
MESSAGE="$1"
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d text="${MESSAGE}" \
  -d parse_mode="Markdown"

# ── Prometheus Alertmanager rule example ────
# alertmanager/rules/p2p.yml
groups:
  - name: p2p-escrow
    rules:
      - alert: APIHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API 5xx error rate > 5%"

      - alert: BlockchainSyncStuck
        expr: changes(blockchain_sync_last_block{chain="bsc"}[10m]) == 0
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "BSC event sync cursor hasn't moved in 10 minutes"

      - alert: CeleryNoWorkers
        expr: celery_workers_active == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "No active Celery workers"
```

---

## 3. Log Management

### Log Format

Production logs use structured JSON for machine parsing:

```json
{
  "timestamp": "2024-02-20T10:30:00.123Z",
  "level": "INFO",
  "logger": "app.api.orders",
  "message": "Order created",
  "request_id": "req_abc123",
  "wallet": "0x742d...bD18",
  "order_id": "uuid-here",
  "chain": "bsc",
  "amount": "25.000000",
  "duration_ms": 45
}
```

**What IS logged** (see [SECURITY.md](SECURITY.md)):
- Request method + path (no body)
- Response status codes
- Error messages (generic)
- Wallet addresses (public data)
- Order/product IDs
- Performance metrics (duration, queue depth)
- Rate limit violations
- Authentication failures

**What is NEVER logged:**
- IP addresses
- Request bodies with encrypted data
- JWT tokens or signatures
- Any PII
- User-Agent strings

### Log Collection

**Docker logs** (default driver):

```bash
# Recent logs for a service
docker compose logs --since 1h api

# Follow logs
docker compose logs -f api celery-events

# JSON output for piping
docker compose logs --no-log-prefix api 2>&1 | jq '.'
```

**For production**, use a centralized logging stack:

```
Services → Docker log driver → Promtail/Fluentd → Loki/Elasticsearch → Grafana
```

**Docker Compose log driver config:**

```yaml
# docker-compose.yml (per service)
services:
  api:
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"
        tag: "p2p-api"
```

### Useful Log Queries

When using Grafana/Loki or similar:

```
# All errors in the last hour
{service="api"} |= "ERROR" | json

# Failed authentication attempts
{service="api"} | json | message="Authentication failed"

# Slow requests (> 1 second)
{service="api"} | json | duration_ms > 1000

# Celery task failures
{service="celery-events"} |= "Task failed"

# Blockchain RPC errors
{service="celery-events"} | json | message=~"RPC.*error|timeout"

# Rate limit violations
{service="api"} | json | message="Rate limit exceeded"

# Orders created in the last 24h
{service="api"} | json | message="Order created"
```

**Command-line equivalents** (without centralized logging):

```bash
# Errors in the last hour
docker compose logs --since 1h api 2>&1 | grep '"level":"ERROR"'

# Slow requests
docker compose logs --since 1h api 2>&1 | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        log = json.loads(line.strip())
        if log.get('duration_ms', 0) > 1000:
            print(f\"{log['timestamp']} {log['message']} {log['duration_ms']}ms\")
    except: pass
"

# Count errors per hour
docker compose logs --since 24h api 2>&1 | grep '"level":"ERROR"' | \
  python3 -c "
import sys, json
from collections import Counter
hours = Counter()
for line in sys.stdin:
    try:
        log = json.loads(line.strip())
        hour = log['timestamp'][:13]
        hours[hour] += 1
    except: pass
for h, c in sorted(hours.items()):
    print(f'{h}: {c} errors')
"
```

### Log Retention

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Application logs (Docker) | 7 days local | Loki/S3 for 90 days |
| Nginx access logs | 30 days | Loki/S3 for 90 days |
| PostgreSQL slow query log | 30 days | Local |
| Celery task logs | 7 days local | Loki/S3 for 30 days |
| Audit logs (admin actions) | 1 year | S3 (encrypted) |

---

## 4. Daily Operations Checklist

Run these checks every morning (or automate in a daily summary script):

```bash
#!/bin/bash
# /opt/p2p-mmo/scripts/daily-check.sh

echo "=== P2P Escrow Daily Check — $(date) ==="

echo -e "\n── 1. Service Health ──"
curl -sf https://api.yourdomain.com/health | jq '.status, .checks | to_entries[] | "\(.key): \(.value.status)"'

echo -e "\n── 2. Container Status ──"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

echo -e "\n── 3. Error Count (last 24h) ──"
docker compose logs --since 24h api 2>&1 | grep -c '"level":"ERROR"' || echo "0"

echo -e "\n── 4. Order Stats (last 24h) ──"
docker compose exec -T postgres psql -U p2p_user -d p2p_escrow -t <<SQL
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'disputed') AS disputed,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired,
  COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS volume
FROM orders
WHERE created_at > NOW() - INTERVAL '24 hours';
SQL

echo -e "\n── 5. Pending Disputes ──"
docker compose exec -T postgres psql -U p2p_user -d p2p_escrow -t <<SQL
SELECT COUNT(*) AS pending_disputes
FROM orders WHERE status = 'disputed';
SQL

echo -e "\n── 6. Blockchain Sync Status ──"
docker compose exec -T postgres psql -U p2p_user -d p2p_escrow -t <<SQL
SELECT chain, last_block, updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at))::int AS seconds_since_update
FROM event_sync_cursor;
SQL

echo -e "\n── 7. Disk Usage ──"
df -h / | tail -1 | awk '{print "Disk: " $5 " used (" $3 "/" $2 ")"}'

echo -e "\n── 8. Database Size ──"
docker compose exec -T postgres psql -U p2p_user -d p2p_escrow -t \
  -c "SELECT pg_size_pretty(pg_database_size('p2p_escrow'));"

echo -e "\n── 9. Redis Memory ──"
docker compose exec -T redis redis-cli -a $REDIS_PASSWORD info memory | grep "used_memory_human"

echo -e "\n── 10. Celery Workers ──"
docker compose exec -T celery-events celery -A app.workers inspect active 2>/dev/null | head -5

echo -e "\n=== Check Complete ==="
```

**Schedule**: `0 8 * * * /opt/p2p-mmo/scripts/daily-check.sh | /opt/p2p-mmo/scripts/alert-telegram.sh`

---

## 5. Scheduled Tasks

### Celery Beat Schedule

```python
# backend/app/workers/celeryconfig.py
from celery.schedules import crontab

beat_schedule = {
    # ── Blockchain ──────────────────────────
    "poll-bsc-events": {
        "task": "app.workers.event_listener.poll_events",
        "schedule": 3.0,       # Every 3 seconds
        "args": ("bsc",),
    },
    "poll-eth-events": {
        "task": "app.workers.event_listener.poll_events",
        "schedule": 12.0,      # Every 12 seconds (ETH block time)
        "args": ("ethereum",),
    },

    # ── Timeout checks ─────────────────────
    "check-seller-timeouts": {
        "task": "app.workers.timeout_checker.check_seller_timeouts",
        "schedule": 60.0,      # Every minute
    },
    "check-buyer-timeouts": {
        "task": "app.workers.timeout_checker.check_buyer_timeouts",
        "schedule": 60.0,
    },

    # ── Maintenance ─────────────────────────
    "cleanup-expired-nonces": {
        "task": "app.workers.maintenance.cleanup_nonces",
        "schedule": crontab(minute="*/15"),     # Every 15 min
    },
    "update-user-tiers": {
        "task": "app.workers.maintenance.recalculate_tiers",
        "schedule": crontab(hour=3, minute=0),  # Daily 03:00 UTC
    },
    "purge-old-messages": {
        "task": "app.workers.maintenance.purge_old_messages",
        "schedule": crontab(day_of_month=1, hour=4, minute=0),  # Monthly
    },
    "purge-deleted-products": {
        "task": "app.workers.maintenance.purge_deleted_products",
        "schedule": crontab(day_of_month=1, hour=4, minute=30),
    },
}
```

### Cron Jobs (System-Level)

```bash
# /etc/cron.d/p2p-operations

# Database backup — daily 03:00 UTC
0 3 * * * root /opt/p2p-mmo/scripts/backup.sh >> /var/log/p2p-backup.log 2>&1

# Database vacuum — weekly Sunday 04:00 UTC
0 4 * * 0 root docker compose -f /opt/p2p-mmo/docker-compose.yml exec -T postgres \
  vacuumdb -U p2p_user -d p2p_escrow -z >> /var/log/p2p-vacuum.log 2>&1

# Daily operations check — 08:00 UTC
0 8 * * * root /opt/p2p-mmo/scripts/daily-check.sh 2>&1 | \
  /opt/p2p-mmo/scripts/alert-telegram.sh

# SSL certificate check — daily
0 6 * * * root certbot renew --quiet --deploy-hook "systemctl reload nginx"

# Old backup cleanup — daily
0 5 * * * root find /backups -name "*.dump.gz" -mtime +30 -delete

# Docker log cleanup — weekly
0 2 * * 0 root docker system prune -f --filter "until=168h" >> /var/log/p2p-docker-prune.log 2>&1
```

### Schedule Summary

| Task | Frequency | Owner | Details |
|------|-----------|-------|---------|
| Blockchain event poll (BSC) | Every 3s | Celery Beat | `event_listener.poll_events` |
| Blockchain event poll (ETH) | Every 12s | Celery Beat | `event_listener.poll_events` |
| Order timeout scan | Every 60s | Celery Beat | `timeout_checker` |
| Nonce cleanup | Every 15 min | Celery Beat | Remove expired Redis nonces |
| Daily health check | 08:00 UTC | Cron | `daily-check.sh` → Telegram |
| Database backup | 03:00 UTC | Cron | `backup.sh` → local + S3 |
| Database vacuum | Sunday 04:00 | Cron | `vacuumdb -z` |
| User tier recalculation | 03:00 UTC | Celery Beat | Batch update tiers |
| Message purge (> 1 year) | 1st of month | Celery Beat | Delete old messages |
| Product purge (deleted > 90d) | 1st of month | Celery Beat | Hard-delete soft-deleted |
| SSL cert renewal | Daily 06:00 | Cron/Certbot | Auto-renew if < 30 days |
| Docker prune | Sunday 02:00 | Cron | Remove dangling images/volumes |
| Backup cleanup | Daily 05:00 | Cron | Remove backups > 30 days |

---

## 6. Runbooks

### RB-01: API Unresponsive

**Trigger**: Health check fails 2 consecutive times.

```
1. CHECK container status
   $ docker compose ps api
   → If "Restarting": check logs (docker compose logs api --tail 50)
   → If "Exited": restart (docker compose restart api)

2. CHECK resource usage
   $ docker stats --no-stream p2p-api
   → Memory > 90%: OOM possible. Restart with lower APP_WORKERS.
   → CPU 100%: possible infinite loop. Check recent deploy.

3. CHECK dependencies
   $ docker compose exec api python -c "from app.core.database import engine; print('DB OK')"
   $ docker compose exec api python -c "import redis; r=redis.from_url('$REDIS_URL'); r.ping(); print('Redis OK')"
   → If DB down: see RB-02
   → If Redis down: see RB-08

4. RESTART
   $ docker compose restart api
   $ sleep 10
   $ curl -sf https://api.yourdomain.com/health

5. ESCALATE if restart doesn't help → check recent code changes, rollback if needed.
```

---

### RB-02: Database Connection Exhaustion

**Trigger**: `db_connection_pool_checked_out > 95%` or "too many connections" errors.

```
1. CHECK current connections
   $ docker compose exec postgres psql -U p2p_user -d p2p_escrow -c \
     "SELECT count(*), state FROM pg_stat_activity WHERE datname='p2p_escrow' GROUP BY state;"

2. IDENTIFY long-running queries
   $ docker compose exec postgres psql -U p2p_user -d p2p_escrow -c \
     "SELECT pid, now()-query_start AS duration, state, left(query,80) AS query
      FROM pg_stat_activity WHERE datname='p2p_escrow' AND state != 'idle'
      ORDER BY duration DESC LIMIT 10;"

3. KILL idle connections (> 10 min idle)
   $ docker compose exec postgres psql -U p2p_user -d p2p_escrow -c \
     "SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname='p2p_escrow' AND state='idle'
        AND state_change < NOW() - INTERVAL '10 minutes';"

4. If still exhausted, RESTART services to release pool
   $ docker compose restart api celery-events celery-timeouts

5. INVESTIGATE root cause:
   - Check DATABASE_POOL_SIZE vs max_connections
   - Look for connection leaks (sessions not properly closed)
   - Consider adding pgBouncer (see DATABASE.md)
```

---

### RB-03: Blockchain Event Sync Lag

**Trigger**: `blockchain_sync_lag_blocks > 100` or sync cursor unchanged for 10 min.

```
1. CHECK sync cursor
   $ docker compose exec postgres psql -U p2p_user -d p2p_escrow -c \
     "SELECT chain, last_block, updated_at FROM event_sync_cursor;"

2. CHECK current block number
   $ cast block-number --rpc-url $BSC_RPC_URL

3. CHECK Celery event worker
   $ docker compose logs celery-events --tail 50
   → "Connection refused": RPC is down → see RB-07
   → "Task error": check specific error message
   → No recent logs: worker may be dead

4. RESTART event listener
   $ docker compose restart celery-events

5. If lag persists, CHECK RPC health
   $ cast block-number --rpc-url $BSC_RPC_URL          # Primary
   $ cast block-number --rpc-url $BSC_RPC_FALLBACK     # Fallback

6. If RPC is down, manually SWITCH to fallback
   Update BSC_RPC_URL in .env → restart celery-events

7. For large lag (> 10,000 blocks), consider increasing worker concurrency
   $ docker compose up -d --scale celery-events=3
```

---

### RB-04: High Dispute Rate

**Trigger**: Dispute rate > 20% of orders in 24h.

```
1. CHECK dispute stats
   $ docker compose exec postgres psql -U p2p_user -d p2p_escrow <<SQL
   SELECT
     COUNT(*) AS total_orders,
     COUNT(*) FILTER (WHERE status = 'disputed') AS disputes,
     ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'disputed') / NULLIF(COUNT(*), 0), 1) AS dispute_pct
   FROM orders
   WHERE created_at > NOW() - INTERVAL '24 hours';
   SQL

2. IDENTIFY repeat offenders
   $ docker compose exec postgres psql -U p2p_user -d p2p_escrow <<SQL
   SELECT seller_wallet, COUNT(*) AS disputes
   FROM orders
   WHERE status = 'disputed' AND created_at > NOW() - INTERVAL '7 days'
   GROUP BY seller_wallet
   ORDER BY disputes DESC LIMIT 10;
   SQL

3. CHECK for scam patterns
   - Multiple disputes from same seller → potential scam seller
   - Multiple disputes from same buyer → potential scam buyer
   - New accounts with high dispute rate → fraud

4. ACTIONS:
   - Blacklist confirmed scam wallets:
     INSERT INTO blacklist (wallet, reason, source) VALUES ('0x...', 'High dispute rate', 'manual');
     UPDATE user_profiles SET is_blacklisted = true WHERE wallet = '0x...';
   - Temporarily lower new seller limits if widespread
   - Consider pausing the platform if attack is ongoing (RB-05)
```

---

### RB-05: Smart Contract Emergency Pause

**Trigger**: P0 incident — potential exploit, fund at risk.

```
⚠️  THIS BLOCKS ALL TRADING. Use only for genuine emergencies.

1. PAUSE the contract IMMEDIATELY
   $ cast send $BSC_ESCROW_CONTRACT "pause()" \
     --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY

2. VERIFY pause is active
   $ cast call $BSC_ESCROW_CONTRACT "paused()" --rpc-url $BSC_RPC_URL
   → Should return: true (0x01)

3. COMMUNICATE
   - Update status page
   - Post in announcement channels
   - Notify team via PagerDuty

4. ASSESS the scope
   - Which orders are affected?
   - Are funds safe in the contract?
   - Is the exploit actively being used?

5. FIX
   - If code bug: deploy new contract, migrate state
   - If admin key compromise: rotate keys, deploy from new owner
   - If economic attack: adjust parameters

6. VERIFY fix on testnet first

7. UNPAUSE (only after thorough verification)
   $ cast send $BSC_ESCROW_CONTRACT "unpause()" \
     --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY

8. POST-MORTEM within 48 hours (see template below)
```

---

### RB-06: JWT Secret Rotation

**Trigger**: Monthly rotation or suspected compromise.

```
⚠️  Rotating JWT_SECRET invalidates ALL active sessions.
     Schedule during low-traffic window (e.g., 03:00 UTC).

1. GENERATE new secret
   $ openssl rand -hex 32
   → Copy output

2. UPDATE .env
   - Replace JWT_SECRET value in backend/.env

3. RESTART API (rolling restart to minimize downtime)
   $ docker compose restart api

4. VERIFY
   $ curl -sf https://api.yourdomain.com/health

5. NOTE: All users must re-authenticate. This is expected.
   Old JWTs will return 401 UNAUTHORIZED.
```

---

### RB-07: RPC Provider Failover

**Trigger**: Primary RPC returns errors or timeouts.

```
1. CHECK primary RPC
   $ cast block-number --rpc-url $BSC_RPC_URL
   → Timeout or error: primary is down

2. CHECK fallback RPC
   $ cast block-number --rpc-url $BSC_RPC_FALLBACK
   → If also down: both providers have issues

3. AUTOMATIC failover should be handled by the backend.
   If not, MANUALLY switch:
   - Edit backend/.env: swap BSC_RPC_URL and BSC_RPC_FALLBACK
   - Restart: docker compose restart api celery-events

4. CHECK provider status pages:
   - NodeReal: https://status.nodereal.io
   - QuickNode: https://status.quicknode.com
   - Alchemy: https://status.alchemy.com
   - Ankr: https://status.ankr.com

5. If both providers down, WAIT and monitor.
   On-chain state is not affected. Only sync is delayed.
```

---

### RB-08: Redis Memory Pressure

**Trigger**: Redis memory usage > 70% of `maxmemory`.

```
1. CHECK memory usage
   $ docker compose exec redis redis-cli -a $REDIS_PASSWORD info memory

2. IDENTIFY large key patterns
   $ docker compose exec redis redis-cli -a $REDIS_PASSWORD --bigkeys

3. CHECK TTL on keys (should all have TTLs)
   $ docker compose exec redis redis-cli -a $REDIS_PASSWORD \
     SCAN 0 COUNT 100 | tail -n +2 | while read key; do
       echo "$key: $(docker compose exec redis redis-cli -a $REDIS_PASSWORD TTL $key)"
     done

4. FLUSH stale cache (safe — will regenerate)
   $ docker compose exec redis redis-cli -a $REDIS_PASSWORD -n 0 FLUSHDB
   (Only flushes cache DB, not Celery DB)

5. If persistent, INCREASE maxmemory in redis.conf or container memory limit.

6. VERIFY eviction policy is set:
   $ docker compose exec redis redis-cli -a $REDIS_PASSWORD config get maxmemory-policy
   → Should be: allkeys-lru
```

---

### RB-09: Celery Queue Backlog

**Trigger**: > 500 tasks queued for > 5 minutes.

```
1. CHECK queue depth
   $ docker compose exec redis redis-cli -a $REDIS_PASSWORD LLEN celery

2. CHECK worker status
   $ docker compose exec celery-events celery -A app.workers inspect active
   $ docker compose exec celery-events celery -A app.workers inspect reserved

3. If workers active but slow → SCALE UP
   $ docker compose up -d --scale celery-events=4

4. If workers not active → RESTART
   $ docker compose restart celery-events celery-timeouts celery-beat

5. If tasks are failing → CHECK logs
   $ docker compose logs celery-events --tail 100 | grep "Task.*failed"

6. PURGE the queue (if tasks are stale/unrecoverable)
   $ docker compose exec celery-events celery -A app.workers purge -f
   ⚠️  This discards all queued tasks. Events will be re-fetched from blockchain on next poll.
```

---

### RB-10: DDoS / Traffic Spike

**Trigger**: Abnormal traffic volume, response degradation.

```
1. CHECK if Cloudflare is active
   - Dashboard: analytics → check request volume
   - Enable "Under Attack Mode" if needed

2. CHECK rate limiting
   $ docker compose logs api --since 5m 2>&1 | grep "Rate limit" | wc -l

3. If attack bypasses Cloudflare:
   - Enable Cloudflare "I'm Under Attack" mode
   - Add firewall rules to block offending IPs/ASNs
   - Temporarily reduce RATE_LIMIT_GLOBAL (e.g., 30/min)

4. SCALE backend if legitimate traffic
   $ docker compose up -d --scale api=3

5. MONITOR until traffic normalizes
   $ watch -n 5 'docker compose logs --since 1m api 2>&1 | wc -l'
```

---

## 7. Incident Management

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|------------|---------------|---------|
| **P0** | Funds at risk, exploit active | Immediate | Reentrancy exploit, contract drain |
| **P1** | Service down, data breach | < 1 hour | API down, DB compromised, all RPCs down |
| **P2** | Degraded service, fraud | < 4 hours | High latency, sync lag, high dispute rate |
| **P3** | Minor issue, cosmetic | < 24 hours | UI glitch, non-critical log error |

### Incident Lifecycle

```
1. DETECT
   └─ Alert fires (automated) or user report

2. TRIAGE (within 5 min)
   ├─ Assign severity (P0-P3)
   ├─ Assign incident commander
   └─ Open incident channel (Telegram/Slack)

3. MITIGATE (immediate)
   ├─ P0: Pause contract, isolate affected systems
   ├─ P1: Restart services, failover
   └─ P2/P3: Apply workaround

4. INVESTIGATE
   ├─ Gather logs, metrics, traces
   ├─ Identify root cause
   └─ Document timeline

5. RESOLVE
   ├─ Deploy fix
   ├─ Verify fix in production
   └─ Confirm metrics return to normal

6. COMMUNICATE
   ├─ Update status page
   ├─ Notify affected users (if applicable)
   └─ Close incident channel

7. POST-MORTEM (within 48h for P0/P1)
```

### Post-Mortem Template

```markdown
# Incident Post-Mortem: [TITLE]

**Date**: YYYY-MM-DD
**Duration**: HH:MM (from detection to resolution)
**Severity**: P0 / P1 / P2
**Commander**: [Name]

## Summary
One-paragraph description of what happened and impact.

## Impact
- Users affected: [number / percentage]
- Orders affected: [number]
- Funds at risk: [amount / none]
- Revenue impact: [amount]

## Timeline (UTC)
| Time | Event |
|------|-------|
| HH:MM | [First sign of issue] |
| HH:MM | [Alert fired] |
| HH:MM | [Mitigation applied] |
| HH:MM | [Root cause identified] |
| HH:MM | [Fix deployed] |
| HH:MM | [Incident resolved] |

## Root Cause
Technical explanation of what caused the incident.

## Resolution
What was done to fix the issue.

## Lessons Learned
### What went well
- ...

### What went poorly
- ...

## Action Items
| Action | Owner | Deadline |
|--------|-------|----------|
| [Improvement] | [Name] | YYYY-MM-DD |
```

---

## 8. On-Chain Operations

### Contract Read Commands

```bash
# ── P2PEscrow status ───────────────────────
cast call $ESCROW "paused()" --rpc-url $BSC_RPC_URL
cast call $ESCROW "treasury()" --rpc-url $BSC_RPC_URL
cast call $ESCROW "arbitratorPool()" --rpc-url $BSC_RPC_URL
cast call $ESCROW "nextOrderId()" --rpc-url $BSC_RPC_URL
cast call $ESCROW "supportedTokens(address)" $USDT_ADDRESS --rpc-url $BSC_RPC_URL

# ── Read a specific order ──────────────────
cast call $ESCROW "orders(uint256)" 42 --rpc-url $BSC_RPC_URL

# ── ArbitratorPool status ──────────────────
cast call $ARB_POOL "activeArbitrators(uint256)" 0 --rpc-url $BSC_RPC_URL   # First arbitrator
cast call $ARB_POOL "arbitrators(address)" $ARBITRATOR_WALLET --rpc-url $BSC_RPC_URL

# ── Contract balance (escrow funds held) ───
cast call $USDT_ADDRESS "balanceOf(address)" $ESCROW --rpc-url $BSC_RPC_URL
```

### Contract Admin Actions

```bash
# ⚠️ All admin actions require owner private key

# Pause / unpause
cast send $ESCROW "pause()" --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY
cast send $ESCROW "unpause()" --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY

# Add/remove supported token
cast send $ESCROW "setSupportedToken(address,bool)" $TOKEN true --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY

# Update treasury
cast send $ESCROW "setTreasury(address)" $NEW_TREASURY --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY

# Manual auto-expire (if Celery missed it)
cast send $ESCROW "autoExpireOrder(uint256)" $ORDER_ID --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY

# Manual auto-release (if Celery missed it)
cast send $ESCROW "autoReleaseToSeller(uint256)" $ORDER_ID --rpc-url $BSC_RPC_URL --private-key $OWNER_KEY
```

### Treasury Management

```bash
# Check treasury balance
cast call $USDT_ADDRESS "balanceOf(address)" $TREASURY_ADDRESS --rpc-url $BSC_RPC_URL

# Monitor fee collection (check OrderCompleted events)
cast logs --from-block 40000000 --to-block latest \
  --address $ESCROW \
  "OrderCompleted(uint256,uint256,uint256)" \
  --rpc-url $BSC_RPC_URL
```

**Treasury best practices:**
- Treasury should be a Gnosis Safe multisig (2-of-3 minimum)
- Withdrawal requires multiple signers
- Set up Gnosis Safe notifications for all transactions
- Monthly reconciliation: on-chain treasury balance vs expected fee revenue

### Arbitrator Pool Monitoring

```sql
-- Active arbitrators and their stats
SELECT wallet, stake_amount, reputation, total_resolved, total_earned, is_active
FROM arbitrators
WHERE is_active = true
ORDER BY reputation DESC;

-- Arbitrators at risk of deactivation (reputation < 20)
SELECT wallet, reputation, total_resolved
FROM arbitrators
WHERE reputation < 20 AND is_active = true;

-- Dispute resolution stats per arbitrator (last 30 days)
SELECT
  o.arbitrator_wallet,
  COUNT(*) AS cases,
  COUNT(*) FILTER (WHERE o.status = 'resolved_buyer') AS favor_buyer,
  COUNT(*) FILTER (WHERE o.status = 'resolved_seller') AS favor_seller
FROM orders o
WHERE o.status IN ('resolved_buyer', 'resolved_seller')
  AND o.updated_at > NOW() - INTERVAL '30 days'
GROUP BY o.arbitrator_wallet;
```

---

## 9. Business Metrics Dashboard

Key business metrics to track (query daily or visualize in Grafana):

```sql
-- ── Daily order volume & revenue ───────────
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS orders,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS volume_usdt,
  COALESCE(SUM(platform_fee) FILTER (WHERE status = 'completed'), 0) AS fees_usdt
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- ── User growth ────────────────────────────
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS new_users,
  SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) AS cumulative_users
FROM user_profiles
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at);

-- ── Dispute rate trend ─────────────────────
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE status IN ('disputed','resolved_buyer','resolved_seller')) AS disputes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('disputed','resolved_buyer','resolved_seller'))
    / NULLIF(COUNT(*), 0), 1) AS dispute_rate_pct
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- ── Top sellers by volume ──────────────────
SELECT
  seller_wallet,
  u.display_name,
  COUNT(*) AS orders,
  SUM(amount) AS total_volume,
  u.rating
FROM orders o
JOIN user_profiles u ON u.wallet = o.seller_wallet
WHERE o.status = 'completed' AND o.created_at > NOW() - INTERVAL '30 days'
GROUP BY seller_wallet, u.display_name, u.rating
ORDER BY total_volume DESC
LIMIT 10;

-- ── Chain distribution ─────────────────────
SELECT
  chain,
  COUNT(*) AS orders,
  SUM(amount) AS volume
FROM orders
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY chain;
```

---

## 10. Capacity Planning

### Current Limits

| Resource | Current Capacity | Usage Trigger for Scaling |
|----------|-----------------|--------------------------|
| API workers | 4 (Uvicorn) | p95 latency > 500ms sustained |
| DB connections | 30 (pool 20 + overflow 10) | > 80% pool utilization |
| Celery event workers | 2 concurrent | Queue depth > 100 sustained |
| Celery timeout workers | 1 concurrent | Timeout scans > 1s |
| Redis memory | 1 GB | > 70% used |
| Disk | Depends on host | > 80% used |
| PostgreSQL storage | Depends on host | Growth rate × months to 80% |

### Growth Estimates

| Metric | Per 1K daily orders | Notes |
|--------|-------------------|-------|
| DB storage growth | ~50 MB/day | Orders + messages + reviews |
| Redis memory | ~20 MB | Mostly cache, bounded by TTLs |
| Blockchain event volume | ~3K events/day | OrderCreated + status changes |
| IPFS storage | ~100 MB/day | Only if disputes are common (~10%) |
| API requests | ~50K/day | ~50 requests per order lifecycle |

### Scaling Playbook

| Bottleneck | Indicator | Action |
|------------|-----------|--------|
| API throughput | Latency > 500ms | Increase `APP_WORKERS` or add API instances behind load balancer |
| Database reads | Read query latency > 100ms | Add read replica (see [DATABASE.md](DATABASE.md#read-replicas)) |
| Database writes | Write queue growing | Vertical scale (more CPU/RAM) or partition orders by chain |
| Redis | Memory > 70% | Increase `maxmemory` or add Redis Cluster |
| Celery events | Queue > 100 | Scale `celery-events` horizontally (`--scale celery-events=4`) |
| Blockchain sync | Sync lag > 1000 blocks | Add dedicated worker per chain |
| Disk | > 80% | Purge old data, expand volume, or enable compression |

---

## 11. Rotation & Secret Management

### Secret Rotation Schedule

| Secret | Rotation | Procedure | Impact |
|--------|----------|-----------|--------|
| `JWT_SECRET` | Monthly | RB-06 | All sessions invalidated |
| `DB_PASSWORD` | Quarterly | Update PostgreSQL + `.env` + restart | Brief downtime |
| `REDIS_PASSWORD` | Quarterly | Update Redis config + `.env` + restart | Brief downtime |
| `PINATA_API_KEY` | Yearly | Generate new key on Pinata dashboard + update `.env` | No downtime |
| `BSCSCAN_API_KEY` | Yearly | Regenerate on BscScan + update contracts `.env` | No impact (deployment only) |
| Contract owner key | As needed | Transfer ownership to new address on-chain | Requires multisig approval |

### Password Rotation Procedure

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 24)

# 2. Update PostgreSQL
docker compose exec postgres psql -U postgres -c \
  "ALTER USER p2p_user PASSWORD '$NEW_PASSWORD';"

# 3. Update .env files
# Edit backend/.env: DATABASE_URL with new password

# 4. Restart services
docker compose restart api celery-events celery-timeouts celery-beat

# 5. Verify
curl -sf https://api.yourdomain.com/health | jq '.checks.database'
```

### Production Secret Storage

For production environments, move beyond `.env` files:

| Approach | Complexity | Recommendation |
|----------|-----------|----------------|
| `.env` files on server | Low | OK for small deployments, encrypt at rest |
| Docker Secrets | Medium | Good for Docker Swarm |
| HashiCorp Vault | High | Best for large teams, audit trails |
| AWS Secrets Manager | Medium | Good if on AWS, auto-rotation |
| GCP Secret Manager | Medium | Good if on GCP |

Regardless of approach, ensure:
- Secrets are never in version control
- Access is audited
- Rotation does not require code changes (config-only)
