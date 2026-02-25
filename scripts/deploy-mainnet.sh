#!/bin/bash
set -euo pipefail

# Deploy contracts to BSC Mainnet
# Usage: ./scripts/deploy-mainnet.sh
#
# CRITICAL: This deploys to MAINNET with real funds!
# Double-check all addresses before running.
#
# Required env vars (set in contracts/.env):
#   PRIVATE_KEY        - Deployer private key (multisig recommended)
#   DEPLOYER_ADDRESS   - Deployer wallet address
#   TREASURY_ADDRESS   - Treasury wallet address (multisig!)
#   BSC_RPC_URL        - BSC Mainnet RPC
#   BSCSCAN_API_KEY    - BscScan API key for verification

echo "============================================"
echo "  BSC MAINNET DEPLOYMENT"
echo "  THIS IS A PRODUCTION DEPLOYMENT!"
echo "============================================"
echo ""

cd "$(dirname "$0")/../contracts"

# Load env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

RPC_URL="${BSC_RPC_URL:-https://bsc-dataseed1.binance.org}"

echo "Network:   BSC Mainnet (Chain ID 56)"
echo "RPC:       $RPC_URL"
echo "Deployer:  $DEPLOYER_ADDRESS"
echo "Treasury:  $TREASURY_ADDRESS"
echo ""

# Safety checks
if [ -z "${DEPLOYER_ADDRESS:-}" ]; then
    echo "ERROR: DEPLOYER_ADDRESS not set"
    exit 1
fi
if [ -z "${TREASURY_ADDRESS:-}" ]; then
    echo "ERROR: TREASURY_ADDRESS not set"
    exit 1
fi
if [ -z "${PRIVATE_KEY:-}" ]; then
    echo "ERROR: PRIVATE_KEY not set"
    exit 1
fi

# Confirm
read -p "Are you sure you want to deploy to BSC MAINNET? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "Step 1: Building contracts..."
forge build

echo ""
echo "Step 2: Running tests..."
forge test --no-match-path "test/*.fuzz.t.sol"

echo ""
echo "Step 3: Deploying to BSC Mainnet..."
forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --slow \
    -vvv \
    2>&1 | tee /tmp/deploy-mainnet.log

echo ""
echo "Step 4: Verifying contracts on BscScan..."
echo "  (extract addresses from deploy log and verify manually)"
echo ""
echo "  forge verify-contract <ARBITRATOR_POOL_ADDRESS> src/ArbitratorPool.sol:ArbitratorPool \\"
echo "    --chain-id 56 --etherscan-api-key $BSCSCAN_API_KEY \\"
echo "    --constructor-args \$(cast abi-encode 'constructor(address,address)' <STAKE_TOKEN> <DEPLOYER>)"
echo ""
echo "  forge verify-contract <ESCROW_ADDRESS> src/P2PEscrow.sol:P2PEscrow \\"
echo "    --chain-id 56 --etherscan-api-key $BSCSCAN_API_KEY \\"
echo "    --constructor-args \$(cast abi-encode 'constructor(address,address,address)' <TREASURY> <POOL> <DEPLOYER>)"
echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE"
echo "============================================"
echo ""
echo "NEXT STEPS:"
echo "  1. Verify contracts on BscScan (commands above)"
echo "  2. Update backend/.env with contract addresses"
echo "  3. Update frontend/.env with contract addresses"
echo "  4. Run: ./scripts/post-deploy-verify.sh"
echo "  5. Transfer ownership to multisig if needed"
echo ""
echo "Deploy log saved to: /tmp/deploy-mainnet.log"
