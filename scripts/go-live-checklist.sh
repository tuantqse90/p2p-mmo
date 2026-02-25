#!/bin/bash
set -euo pipefail

# Go-Live Checklist Runner
# Verifies everything is ready for production launch
#
# Usage: ./scripts/go-live-checklist.sh

echo "============================================"
echo "  P2P MARKETPLACE GO-LIVE CHECKLIST"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

PASS=0
FAIL=0
WARN=0

check_pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
check_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
check_warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

# --- 1. Smart Contracts ---
echo "1. SMART CONTRACTS"

if [ -n "${ESCROW_CONTRACT_ADDRESS:-}" ] && [ "${ESCROW_CONTRACT_ADDRESS}" != "0x..." ]; then
    check_pass "Escrow contract deployed: $ESCROW_CONTRACT_ADDRESS"
else
    check_fail "Escrow contract not deployed"
fi

if [ -n "${ARBITRATOR_POOL_ADDRESS:-}" ] && [ "${ARBITRATOR_POOL_ADDRESS}" != "0x..." ]; then
    check_pass "ArbitratorPool deployed: $ARBITRATOR_POOL_ADDRESS"
else
    check_fail "ArbitratorPool not deployed"
fi

# Check BscScan verification (requires curl + API key)
if [ -n "${BSCSCAN_API_KEY:-}" ]; then
    VERIFIED=$(curl -sf "https://api.bscscan.com/api?module=contract&action=getabi&address=${ESCROW_CONTRACT_ADDRESS:-}&apikey=$BSCSCAN_API_KEY" 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status","0"))' 2>/dev/null || echo "0")
    if [ "$VERIFIED" = "1" ]; then
        check_pass "Escrow verified on BscScan"
    else
        check_warn "Escrow NOT verified on BscScan"
    fi
else
    check_warn "BscScan API key not set (skipping verification check)"
fi

# --- 2. Backend ---
echo ""
echo "2. BACKEND"

if [ -f ".env" ] || [ -f "backend/.env" ]; then
    check_pass "Backend .env file exists"
else
    check_fail "Backend .env file missing"
fi

if [ -n "${JWT_SECRET_KEY:-}" ] && [ "${JWT_SECRET_KEY}" != "change-me-in-production" ] && [ "${JWT_SECRET_KEY}" != "dev-jwt-secret-do-not-use-in-production" ]; then
    check_pass "JWT secret is production-safe"
else
    check_fail "JWT secret is still a dev value!"
fi

if [ -n "${DB_PASSWORD:-}" ] && [ "${DB_PASSWORD}" != "p2p_dev_password" ]; then
    check_pass "Database password is production-safe"
else
    check_fail "Database password is still a dev value!"
fi

# --- 3. Frontend ---
echo ""
echo "3. FRONTEND"

if [ -n "${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-}" ] && [ "${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}" != "placeholder" ]; then
    check_pass "WalletConnect project ID set"
else
    check_fail "WalletConnect project ID not set"
fi

# --- 4. Infrastructure ---
echo ""
echo "4. INFRASTRUCTURE"

if command -v docker &> /dev/null; then
    check_pass "Docker installed"
else
    check_fail "Docker not installed"
fi

# Check SSL certs
if [ -f "nginx/certs/fullchain.pem" ] && [ -f "nginx/certs/privkey.pem" ]; then
    check_pass "SSL certificates present"
else
    check_warn "SSL certificates not found (using Cloudflare?)"
fi

# --- 5. Backups ---
echo ""
echo "5. BACKUPS"

if [ -d "backups" ]; then
    BACKUP_COUNT=$(find backups -name "*.sql.gz" 2>/dev/null | wc -l)
    if [ "$BACKUP_COUNT" -gt 0 ]; then
        check_pass "Database backups exist ($BACKUP_COUNT found)"
    else
        check_warn "No database backups found"
    fi
else
    check_warn "Backup directory not created"
fi

# --- 6. Monitoring ---
echo ""
echo "6. MONITORING"

if [ -f "monitoring/prometheus.yml" ]; then
    check_pass "Prometheus config exists"
else
    check_warn "Prometheus not configured"
fi

# --- 7. Arbitrators ---
echo ""
echo "7. ARBITRATORS"

if [ -n "${ARBITRATOR_POOL_ADDRESS:-}" ] && [ -n "${BSC_RPC_URL:-}" ]; then
    ARB_COUNT=$(cd contracts 2>/dev/null && cast call "$ARBITRATOR_POOL_ADDRESS" "getActiveArbitratorCount()(uint256)" --rpc-url "$BSC_RPC_URL" 2>/dev/null || echo "0")
    if [ "$ARB_COUNT" -gt 0 ]; then
        check_pass "Active arbitrators: $ARB_COUNT"
    else
        check_warn "No active arbitrators (seed them with scripts/seed-arbitrators.sh)"
    fi
else
    check_warn "Cannot check arbitrators (missing contract address or RPC)"
fi

# --- Summary ---
echo ""
echo "============================================"
echo "  RESULTS"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "  BLOCKING: $FAIL issue(s) must be fixed before go-live!"
    exit 1
elif [ "$WARN" -gt 0 ]; then
    echo ""
    echo "  READY with $WARN warning(s). Review before launch."
    exit 0
else
    echo ""
    echo "  ALL CLEAR! Ready for go-live."
    exit 0
fi
