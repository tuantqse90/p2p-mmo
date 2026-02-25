#!/bin/bash
set -euo pipefail

# Seed initial arbitrators on BSC Mainnet
# Usage: ./scripts/seed-arbitrators.sh
#
# This script registers initial arbitrators by calling ArbitratorPool.register()
# Each arbitrator needs:
#   1. A funded wallet (for gas)
#   2. At least 500 USDT approved to ArbitratorPool
#   3. A call to ArbitratorPool.register()
#
# Prerequisites:
#   - ARBITRATOR_POOL_ADDRESS set in env
#   - USDT_ADDRESS set in env
#   - Each arbitrator's PRIVATE_KEY

echo "============================================"
echo "  SEED INITIAL ARBITRATORS"
echo "============================================"
echo ""

cd "$(dirname "$0")/../contracts"

if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

RPC_URL="${BSC_RPC_URL:-https://bsc-dataseed1.binance.org}"
POOL="${ARBITRATOR_POOL_ADDRESS:?ARBITRATOR_POOL_ADDRESS not set}"
USDT="${USDT_ADDRESS:-0x55d398326f99059fF775485246999027B3197955}"
STAKE_AMOUNT="500000000000000000000" # 500 USDT (18 decimals)

echo "Pool:  $POOL"
echo "USDT:  $USDT"
echo "Stake: 500 USDT"
echo "RPC:   $RPC_URL"
echo ""

# Define arbitrator private keys (set these in env or pass as args)
ARBITRATORS=(
    "${ARB1_PRIVATE_KEY:-}"
    "${ARB2_PRIVATE_KEY:-}"
    "${ARB3_PRIVATE_KEY:-}"
)

for i in "${!ARBITRATORS[@]}"; do
    KEY="${ARBITRATORS[$i]}"
    if [ -z "$KEY" ]; then
        echo "Skipping arbitrator $((i+1)): no private key set (ARB$((i+1))_PRIVATE_KEY)"
        continue
    fi

    ADDR=$(cast wallet address "$KEY")
    echo "Registering arbitrator $((i+1)): $ADDR"

    # Step 1: Approve USDT spending
    echo "  Approving 500 USDT..."
    cast send "$USDT" "approve(address,uint256)" "$POOL" "$STAKE_AMOUNT" \
        --rpc-url "$RPC_URL" \
        --private-key "$KEY" \
        --confirmations 3 \
        2>/dev/null

    # Step 2: Register as arbitrator
    echo "  Registering..."
    cast send "$POOL" "register()" \
        --rpc-url "$RPC_URL" \
        --private-key "$KEY" \
        --confirmations 3 \
        2>/dev/null

    echo "  Done! Arbitrator $ADDR registered."
    echo ""
done

# Check active count
echo "Active arbitrators:"
cast call "$POOL" "getActiveArbitratorCount()(uint256)" --rpc-url "$RPC_URL"
echo ""
echo "Seeding complete!"
