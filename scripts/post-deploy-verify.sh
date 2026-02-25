#!/bin/bash
set -euo pipefail

# Post-deployment verification checklist
# Verifies all services are running correctly after mainnet deployment
#
# Usage: ./scripts/post-deploy-verify.sh [api_url]
#   api_url: Backend API URL (default: http://localhost:8000)

API_URL="${1:-http://localhost:8000}"
PASS=0
FAIL=0

check() {
    local name="$1"
    local result="$2"
    if [ "$result" = "true" ]; then
        echo "  [PASS] $name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $name"
        FAIL=$((FAIL + 1))
    fi
}

echo "============================================"
echo "  POST-DEPLOYMENT VERIFICATION"
echo "  API: $API_URL"
echo "============================================"
echo ""

# 1. Health endpoint
echo "1. Backend Health"
HEALTH=$(curl -sf "$API_URL/health" 2>/dev/null || echo '{}')
check "Health endpoint responds" "$(echo "$HEALTH" | python3 -c 'import sys,json; print("true" if json.load(sys.stdin) else "false")' 2>/dev/null || echo false)"

# 2. Auth endpoints
echo ""
echo "2. Auth Endpoints"
NONCE=$(curl -sf -X POST "$API_URL/auth/nonce" \
    -H "Content-Type: application/json" \
    -d '{"wallet_address": "0x0000000000000000000000000000000000000001"}' \
    -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
check "POST /auth/nonce returns 200" "$([ "$NONCE" = "200" ] && echo true || echo false)"

# 3. Products endpoint
echo ""
echo "3. Products Endpoint"
PRODUCTS=$(curl -sf "$API_URL/products" -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")
check "GET /products returns 200" "$([ "$PRODUCTS" = "200" ] && echo true || echo false)"

# 4. Database connectivity
echo ""
echo "4. Database"
DB_OK=$(echo "$HEALTH" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("true" if d.get("database","")=="ok" else "false")' 2>/dev/null || echo false)
check "Database connected" "$DB_OK"

# 5. Redis connectivity
echo ""
echo "5. Redis"
REDIS_OK=$(echo "$HEALTH" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("true" if d.get("redis","")=="ok" else "false")' 2>/dev/null || echo false)
check "Redis connected" "$REDIS_OK"

# 6. Contract addresses configured
echo ""
echo "6. Smart Contracts"
if [ -n "${ESCROW_CONTRACT_ADDRESS:-}" ] && [ "$ESCROW_CONTRACT_ADDRESS" != "0x" ] && [ "$ESCROW_CONTRACT_ADDRESS" != "" ]; then
    check "Escrow contract address set" "true"
else
    check "Escrow contract address set" "false"
fi

if [ -n "${ARBITRATOR_POOL_ADDRESS:-}" ] && [ "$ARBITRATOR_POOL_ADDRESS" != "0x" ] && [ "$ARBITRATOR_POOL_ADDRESS" != "" ]; then
    check "ArbitratorPool address set" "true"
else
    check "ArbitratorPool address set" "false"
fi

# 7. SSL check (if HTTPS)
echo ""
echo "7. SSL/TLS"
if [[ "$API_URL" == https://* ]]; then
    SSL_OK=$(curl -sf --max-time 5 "$API_URL" -o /dev/null && echo true || echo false)
    check "HTTPS responds" "$SSL_OK"
else
    echo "  [SKIP] Not using HTTPS (local)"
fi

# 8. Security headers
echo ""
echo "8. Security Headers"
HEADERS=$(curl -sfI "$API_URL/health" 2>/dev/null || echo "")
check "X-Content-Type-Options present" "$(echo "$HEADERS" | grep -qi 'x-content-type-options' && echo true || echo false)"
check "X-Frame-Options present" "$(echo "$HEADERS" | grep -qi 'x-frame-options' && echo true || echo false)"

# Summary
echo ""
echo "============================================"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
    echo "  WARNING: Some checks failed!"
    exit 1
else
    echo "  All checks passed!"
    exit 0
fi
