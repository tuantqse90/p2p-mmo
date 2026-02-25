#!/bin/bash
set -e

# ── Configuration ──
API_URL="${API_URL:-http://localhost:8000}"
RPC_URL="${RPC_URL:-http://localhost:8545}"
MAX_WAIT=120  # seconds to wait for services

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "P2P Escrow - E2E Test Runner"
echo "========================================"
echo "API: $API_URL"
echo "RPC: $RPC_URL"
echo ""

# ── Check if services are running, start if needed ──
check_service() {
    curl -sf "$1" > /dev/null 2>&1
}

if ! check_service "$API_URL/health"; then
    echo "Backend not running. Starting docker-compose..."
    cd "$PROJECT_DIR"
    docker compose up -d
    echo "Waiting for services to start..."
fi

# ── Wait for Anvil ──
echo "Waiting for Anvil..."
elapsed=0
while ! curl -sf -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' > /dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$MAX_WAIT" ]; then
        echo "ERROR: Anvil not ready after ${MAX_WAIT}s"
        exit 1
    fi
done
echo "Anvil is ready."

# ── Wait for Backend ──
echo "Waiting for backend API..."
elapsed=0
while ! check_service "$API_URL/health"; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [ "$elapsed" -ge "$MAX_WAIT" ]; then
        echo "ERROR: Backend not ready after ${MAX_WAIT}s"
        echo "Checking backend logs..."
        cd "$PROJECT_DIR"
        docker compose logs --tail=50 backend 2>/dev/null || true
        exit 1
    fi
done
echo "Backend is ready."

# ── Check if addresses.json exists ──
ADDRESSES_FILE="$PROJECT_DIR/scripts/addresses.json"
if [ ! -f "$ADDRESSES_FILE" ]; then
    # Try to copy from docker volume
    echo "Extracting addresses from docker volume..."
    cd "$PROJECT_DIR"
    docker compose cp deploy-contracts:/shared/addresses.json "$ADDRESSES_FILE" 2>/dev/null || true
fi

if [ -f "$ADDRESSES_FILE" ]; then
    echo "Contract addresses:"
    cat "$ADDRESSES_FILE"
    echo ""
fi

# ── Install Python dependencies if needed ──
if ! python3 -c "import httpx, web3, eth_account, nacl" 2>/dev/null; then
    echo "Installing Python test dependencies..."
    pip3 install httpx web3 eth-account pynacl --quiet
fi

# ── Run E2E tests ──
echo ""
echo "Running E2E tests..."
echo ""

API_URL="$API_URL" RPC_URL="$RPC_URL" python3 "$SCRIPT_DIR/e2e-test.py"
