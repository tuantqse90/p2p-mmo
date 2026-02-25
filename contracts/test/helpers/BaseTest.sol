// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./MockERC20.sol";
import {ArbitratorPool} from "../../src/ArbitratorPool.sol";
import {P2PEscrow} from "../../src/P2PEscrow.sol";

/// @notice Shared test setup for all contract tests
abstract contract BaseTest is Test {
    MockERC20 public usdt;
    MockERC20 public usdc;
    ArbitratorPool public pool;
    P2PEscrow public escrow;

    address public owner = makeAddr("owner");
    address public treasury = makeAddr("treasury");
    address public buyer = makeAddr("buyer");
    address public seller = makeAddr("seller");
    address public arbitrator1 = makeAddr("arbitrator1");
    address public arbitrator2 = makeAddr("arbitrator2");
    address public arbitrator3 = makeAddr("arbitrator3");
    address public randomUser = makeAddr("randomUser");

    uint256 public constant INITIAL_BALANCE = 100_000e6; // 100k USDT/USDC
    uint256 public constant ORDER_AMOUNT = 100e6; // 100 USDT
    uint256 public constant PLATFORM_FEE = 2e6; // 2% of 100 = 2 USDT
    uint256 public constant ARB_FEE = 5e6; // 5% of 100 = 5 USDT
    uint256 public constant MIN_STAKE = 500e6; // 500 USDT
    bytes32 public constant PRODUCT_HASH = keccak256("test-product-data");

    function setUp() public virtual {
        // Deploy tokens
        usdt = new MockERC20("Tether USD", "USDT", 6);
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // Deploy contracts
        vm.startPrank(owner);
        pool = new ArbitratorPool(address(usdt), owner);
        escrow = new P2PEscrow(treasury, address(pool), owner);
        pool.setEscrowContract(address(escrow));
        escrow.setSupportedToken(address(usdt), true);
        escrow.setSupportedToken(address(usdc), true);
        vm.stopPrank();

        // Fund accounts
        usdt.mint(buyer, INITIAL_BALANCE);
        usdt.mint(seller, INITIAL_BALANCE);
        usdt.mint(arbitrator1, INITIAL_BALANCE);
        usdt.mint(arbitrator2, INITIAL_BALANCE);
        usdt.mint(arbitrator3, INITIAL_BALANCE);
        usdt.mint(randomUser, INITIAL_BALANCE);

        usdc.mint(buyer, INITIAL_BALANCE);

        // Approve escrow for buyer
        vm.prank(buyer);
        usdt.approve(address(escrow), type(uint256).max);

        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);

        // Approve pool for arbitrators
        vm.prank(arbitrator1);
        usdt.approve(address(pool), type(uint256).max);
        vm.prank(arbitrator2);
        usdt.approve(address(pool), type(uint256).max);
        vm.prank(arbitrator3);
        usdt.approve(address(pool), type(uint256).max);
    }

    // --- Helpers ---

    /// @notice Create a standard order (buyer → seller, 100 USDT)
    function _createOrder() internal returns (uint256) {
        vm.prank(buyer);
        return escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
    }

    /// @notice Register all 3 arbitrators with minimum stake
    function _registerArbitrators() internal {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);
        vm.prank(arbitrator2);
        pool.register(MIN_STAKE);
        vm.prank(arbitrator3);
        pool.register(MIN_STAKE);
    }

    /// @notice Create order + seller confirms delivery
    function _createAndConfirm() internal returns (uint256) {
        uint256 orderId = _createOrder();
        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);
        return orderId;
    }

    /// @notice Create order + seller confirms + open dispute (with arbitrators registered)
    function _createAndDispute() internal returns (uint256) {
        _registerArbitrators();
        uint256 orderId = _createAndConfirm();
        vm.prank(buyer);
        escrow.openDispute(orderId, "QmBuyerEvidence123");
        return orderId;
    }
}
