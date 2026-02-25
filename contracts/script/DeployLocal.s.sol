// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ArbitratorPool} from "../src/ArbitratorPool.sol";
import {P2PEscrow} from "../src/P2PEscrow.sol";

/// @notice Deploy P2PEscrow + ArbitratorPool to local Anvil
/// Accepts USDT_ADDRESS env var instead of hardcoded BSC mainnet addresses
contract DeployLocal is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address usdtAddress = vm.envAddress("USDT_ADDRESS");

        vm.startBroadcast();

        // 1. Deploy ArbitratorPool (using USDT as stake token)
        ArbitratorPool pool = new ArbitratorPool(usdtAddress, deployer);
        console.log("ArbitratorPool deployed at:", address(pool));

        // 2. Deploy P2PEscrow
        P2PEscrow escrow = new P2PEscrow(treasury, address(pool), deployer);
        console.log("P2PEscrow deployed at:", address(escrow));

        // 3. Link escrow to pool
        pool.setEscrowContract(address(escrow));
        console.log("Escrow linked to ArbitratorPool");

        // 4. Enable mock USDT as supported token
        escrow.setSupportedToken(usdtAddress, true);
        console.log("USDT enabled");

        vm.stopBroadcast();

        // Summary
        console.log("--- Local Deployment Summary ---");
        console.log("ArbitratorPool:", address(pool));
        console.log("P2PEscrow:     ", address(escrow));
        console.log("Treasury:      ", treasury);
        console.log("USDT:          ", usdtAddress);
    }
}
