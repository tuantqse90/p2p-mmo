// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ArbitratorPool} from "../src/ArbitratorPool.sol";
import {P2PEscrow} from "../src/P2PEscrow.sol";

/// @notice Deploy P2PEscrow + ArbitratorPool to BSC Testnet (Chapel)
/// @dev BSC Testnet uses different token addresses
contract DeployTestnet is Script {
    // BSC Testnet mock USDT (example — deploy your own or use faucet tokens)
    address constant TESTNET_USDT = 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd;
    // BSC Testnet mock USDC
    address constant TESTNET_USDC = 0x64544969ed7EBf5f083679233325356EbE738930;

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address stakeToken = vm.envOr("STAKE_TOKEN", TESTNET_USDT);

        console.log("Deploying to BSC Testnet (Chapel)...");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);

        vm.startBroadcast();

        // 1. Deploy ArbitratorPool
        ArbitratorPool pool = new ArbitratorPool(stakeToken, deployer);
        console.log("ArbitratorPool deployed at:", address(pool));

        // 2. Deploy P2PEscrow
        P2PEscrow escrow = new P2PEscrow(treasury, address(pool), deployer);
        console.log("P2PEscrow deployed at:", address(escrow));

        // 3. Link escrow to pool
        pool.setEscrowContract(address(escrow));
        console.log("Escrow linked to ArbitratorPool");

        // 4. Enable supported tokens
        escrow.setSupportedToken(TESTNET_USDT, true);
        escrow.setSupportedToken(TESTNET_USDC, true);
        console.log("Testnet USDT and USDC enabled");

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== BSC Testnet Deployment Summary ===");
        console.log("ArbitratorPool:", address(pool));
        console.log("P2PEscrow:     ", address(escrow));
        console.log("Treasury:      ", treasury);
        console.log("Stake Token:   ", stakeToken);
        console.log("");
        console.log("Next steps:");
        console.log("1. Update backend .env with contract addresses");
        console.log("2. Update frontend .env with contract addresses");
        console.log("3. Verify contracts on BscScan:");
        console.log("   forge verify-contract <ArbitratorPool> ArbitratorPool --chain-id 97");
        console.log("   forge verify-contract <P2PEscrow> P2PEscrow --chain-id 97");
    }
}
