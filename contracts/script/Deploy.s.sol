// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ArbitratorPool} from "../src/ArbitratorPool.sol";
import {P2PEscrow} from "../src/P2PEscrow.sol";

/// @notice Deploy P2PEscrow + ArbitratorPool to BSC
contract Deploy is Script {
    // BSC Mainnet token addresses
    address constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;
    address constant BSC_USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        // Stake token for ArbitratorPool (USDT on BSC)
        address stakeToken = vm.envOr("STAKE_TOKEN", BSC_USDT);

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
        escrow.setSupportedToken(BSC_USDT, true);
        escrow.setSupportedToken(BSC_USDC, true);
        console.log("USDT and USDC enabled");

        vm.stopBroadcast();

        // Summary
        console.log("--- Deployment Summary ---");
        console.log("ArbitratorPool:", address(pool));
        console.log("P2PEscrow:     ", address(escrow));
        console.log("Treasury:      ", treasury);
        console.log("Stake Token:   ", stakeToken);
    }
}
