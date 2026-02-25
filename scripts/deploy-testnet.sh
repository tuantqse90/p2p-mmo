#!/bin/bash
set -euo pipefail

# Deploy contracts to BSC Testnet (Chapel)
# Usage: ./scripts/deploy-testnet.sh
#
# Required env vars (set in contracts/.env):
#   PRIVATE_KEY       - Deployer private key
#   DEPLOYER_ADDRESS  - Deployer wallet address
#   TREASURY_ADDRESS  - Treasury wallet address
#   BSC_TESTNET_RPC_URL - BSC Testnet RPC (default: Chapel public RPC)
#   BSCSCAN_API_KEY   - BscScan API key for verification

echo "=== BSC Testnet Deployment ==="

cd "$(dirname "$0")/../contracts"

# Load env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

RPC_URL="${BSC_TESTNET_RPC_URL:-https://data-seed-prebsc-1-s1.binance.org:8545}"

echo "RPC: $RPC_URL"
echo "Deployer: $DEPLOYER_ADDRESS"
echo "Treasury: $TREASURY_ADDRESS"
echo ""

# Deploy
echo "Deploying contracts..."
forge script script/DeployTestnet.s.sol:DeployTestnet \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --verify \
    --etherscan-api-key "${BSCSCAN_API_KEY:-}" \
    -vvv

echo ""
echo "Deployment complete!"
echo ""
echo "=== Post-deploy verification ==="
echo "If verify failed during deploy, run manually:"
echo "  cd contracts"
echo "  forge verify-contract <ARBITRATOR_POOL_ADDR> src/ArbitratorPool.sol:ArbitratorPool --chain-id 97 --etherscan-api-key \$BSCSCAN_API_KEY --constructor-args \$(cast abi-encode 'constructor(address,address)' <STAKE_TOKEN> <DEPLOYER>)"
echo "  forge verify-contract <ESCROW_ADDR> src/P2PEscrow.sol:P2PEscrow --chain-id 97 --etherscan-api-key \$BSCSCAN_API_KEY --constructor-args \$(cast abi-encode 'constructor(address,address,address)' <TREASURY> <POOL_ADDR> <DEPLOYER>)"
echo ""
echo "Update these files with the deployed addresses:"
echo "  - backend/.env (ESCROW_CONTRACT_ADDRESS, ARBITRATOR_POOL_ADDRESS)"
echo "  - frontend/.env (NEXT_PUBLIC_ESCROW_ADDRESS, NEXT_PUBLIC_ARBITRATOR_POOL_ADDRESS)"
