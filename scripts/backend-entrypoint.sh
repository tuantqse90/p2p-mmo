#!/bin/sh
set -e

SHARED_DIR="/shared"
ADDRESSES_FILE="$SHARED_DIR/addresses.json"

# ── Wait for addresses.json from deploy-contracts ──
echo "Waiting for contract addresses..."
for i in $(seq 1 60); do
    if [ -f "$ADDRESSES_FILE" ]; then
        echo "Found addresses.json (attempt $i)"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "ERROR: $ADDRESSES_FILE not found after 60 seconds"
        exit 1
    fi
    sleep 1
done

# ── Read addresses and export as env vars (use python instead of jq) ──
ESCROW_ADDRESS=$(python3 -c "import json; print(json.load(open('$ADDRESSES_FILE'))['escrow'])")
ARBITRATOR_POOL_ADDRESS=$(python3 -c "import json; print(json.load(open('$ADDRESSES_FILE'))['arbitratorPool'])")
USDT_ADDRESS=$(python3 -c "import json; print(json.load(open('$ADDRESSES_FILE'))['usdt'])")

export ESCROW_CONTRACT_ADDRESS="$ESCROW_ADDRESS"
export ARBITRATOR_POOL_ADDRESS="$ARBITRATOR_POOL_ADDRESS"
export USDT_ADDRESS="$USDT_ADDRESS"
export CONTRACT_ABI_DIR="$SHARED_DIR/abi"

echo "Contract addresses loaded:"
echo "  Escrow:         $ESCROW_CONTRACT_ADDRESS"
echo "  ArbitratorPool: $ARBITRATOR_POOL_ADDRESS"
echo "  USDT:           $USDT_ADDRESS"
echo "  ABI dir:        $CONTRACT_ABI_DIR"

# ── Run the command passed as arguments ──
exec "$@"
