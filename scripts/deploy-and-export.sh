#!/bin/sh
set -e

# ── Configuration ──
RPC_URL="http://anvil:8545"
SHARED_DIR="/shared"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DEPLOYER="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

# Anvil default accounts (deterministic)
BUYER="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
SELLER="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
ARBITRATOR="0x90F79bf6EB2c4f870365E785982E1f101E93b906"

# ── Wait for Anvil ──
echo "Waiting for Anvil to be ready..."
for i in $(seq 1 30); do
    if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
        echo "Anvil is ready (attempt $i)"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERROR: Anvil not ready after 30 attempts"
        exit 1
    fi
    sleep 1
done

# ── Install Foundry dependencies if missing ──
cd /contracts
if [ ! -d "lib/forge-std" ]; then
    echo "Installing Foundry dependencies..."
    forge install --no-commit
fi

# ── Build contracts ──
echo "Building contracts..."
forge build

# ── Deploy MockERC20 (USDT with 18 decimals) ──
echo "Deploying MockERC20 (USDT)..."
USDT_OUTPUT=$(forge create test/helpers/MockERC20.sol:MockERC20 \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --constructor-args "MockUSDT" "USDT" 18 2>&1)

echo "$USDT_OUTPUT"
# Parse "Deployed to: 0x..." from text output
USDT_ADDRESS=$(echo "$USDT_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
echo "MockERC20 (USDT) deployed at: $USDT_ADDRESS"

if [ -z "$USDT_ADDRESS" ]; then
    echo "ERROR: Failed to extract USDT address"
    exit 1
fi

# ── Mint 100,000 USDT to test accounts ──
MINT_AMOUNT="100000000000000000000000" # 100,000 * 10^18

echo "Minting USDT to buyer ($BUYER)..."
cast send "$USDT_ADDRESS" "mint(address,uint256)" "$BUYER" "$MINT_AMOUNT" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" > /dev/null

echo "Minting USDT to seller ($SELLER)..."
cast send "$USDT_ADDRESS" "mint(address,uint256)" "$SELLER" "$MINT_AMOUNT" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" > /dev/null

echo "Minting USDT to arbitrator ($ARBITRATOR)..."
cast send "$USDT_ADDRESS" "mint(address,uint256)" "$ARBITRATOR" "$MINT_AMOUNT" \
    --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" > /dev/null

# ── Deploy ArbitratorPool + P2PEscrow ──
echo "Deploying ArbitratorPool + P2PEscrow..."
DEPLOY_OUTPUT=$(DEPLOYER_ADDRESS="$DEPLOYER" \
    TREASURY_ADDRESS="$DEPLOYER" \
    USDT_ADDRESS="$USDT_ADDRESS" \
    forge script script/DeployLocal.s.sol:DeployLocal \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract addresses from forge console.log output
POOL_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "ArbitratorPool deployed at:" | awk '{print $NF}')
ESCROW_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "P2PEscrow deployed at:" | awk '{print $NF}')

if [ -z "$POOL_ADDRESS" ] || [ -z "$ESCROW_ADDRESS" ]; then
    echo "WARNING: Failed to extract from log output, trying broadcast JSON..."
    # Fallback: parse from the broadcast JSON using grep/sed
    BROADCAST_FILE=$(find /contracts/broadcast -name "run-latest.json" -path "*/DeployLocal*" 2>/dev/null | head -1)
    if [ -n "$BROADCAST_FILE" ]; then
        # Extract contractAddress fields in order (ArbitratorPool is first, P2PEscrow is second)
        ADDRESSES=$(grep '"contractAddress"' "$BROADCAST_FILE" | sed 's/.*"contractAddress"[[:space:]]*:[[:space:]]*"//' | sed 's/".*//')
        POOL_ADDRESS=$(echo "$ADDRESSES" | sed -n '1p')
        ESCROW_ADDRESS=$(echo "$ADDRESSES" | sed -n '2p')
    fi
fi

if [ -z "$POOL_ADDRESS" ] || [ -z "$ESCROW_ADDRESS" ]; then
    echo "ERROR: Could not determine contract addresses"
    exit 1
fi

echo "ArbitratorPool: $POOL_ADDRESS"
echo "P2PEscrow:      $ESCROW_ADDRESS"
echo "USDT:           $USDT_ADDRESS"

# ── Export to shared volume ──
mkdir -p "$SHARED_DIR/abi"

# Write addresses.json
cat > "$SHARED_DIR/addresses.json" <<EOF
{
    "escrow": "$ESCROW_ADDRESS",
    "arbitratorPool": "$POOL_ADDRESS",
    "usdt": "$USDT_ADDRESS",
    "deployer": "$DEPLOYER",
    "buyer": "$BUYER",
    "seller": "$SELLER",
    "arbitrator": "$ARBITRATOR"
}
EOF

# Copy ABIs to shared volume (Foundry output format: out/<Contract>.sol/<Contract>.json)
for CONTRACT in P2PEscrow ArbitratorPool; do
    SRC="out/${CONTRACT}.sol/${CONTRACT}.json"
    if [ -f "$SRC" ]; then
        mkdir -p "$SHARED_DIR/abi/${CONTRACT}.sol"
        cp "$SRC" "$SHARED_DIR/abi/${CONTRACT}.sol/${CONTRACT}.json"
        echo "Copied ABI: $CONTRACT"
    else
        echo "WARNING: ABI not found at $SRC"
    fi
done

# Also copy MockERC20 ABI
if [ -f "out/MockERC20.sol/MockERC20.json" ]; then
    mkdir -p "$SHARED_DIR/abi/MockERC20.sol"
    cp "out/MockERC20.sol/MockERC20.json" "$SHARED_DIR/abi/MockERC20.sol/MockERC20.json"
    echo "Copied ABI: MockERC20"
fi

echo ""
echo "=== Deployment Complete ==="
echo "Addresses written to $SHARED_DIR/addresses.json"
echo "ABIs written to $SHARED_DIR/abi/"
