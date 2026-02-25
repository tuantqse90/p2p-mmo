// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "../helpers/BaseTest.sol";
import {IP2PEscrow} from "../../src/interfaces/IP2PEscrow.sol";
import {IArbitratorPool} from "../../src/interfaces/IArbitratorPool.sol";

/// @notice Integration tests for complete user flows
contract FullFlowTest is BaseTest {
    // ========================
    // Happy Path Flow
    // ========================

    function test_happyPath_fullFlow() public {
        // 1. Buyer creates order
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Created));

        // 2. Seller confirms delivery
        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.SellerConfirmed));

        // 3. Buyer confirms receipt
        uint256 sellerBal = usdt.balanceOf(seller);
        uint256 treasuryBal = usdt.balanceOf(treasury);

        vm.prank(buyer);
        escrow.buyerConfirmReceived(orderId);

        o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Completed));
        assertEq(usdt.balanceOf(seller), sellerBal + ORDER_AMOUNT);
        assertEq(usdt.balanceOf(treasury), treasuryBal + PLATFORM_FEE);
        assertEq(usdt.balanceOf(address(escrow)), 0);
    }

    // ========================
    // Cancellation Flow
    // ========================

    function test_cancellation_fullRefund() public {
        uint256 buyerBal = usdt.balanceOf(buyer);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        assertEq(usdt.balanceOf(buyer), buyerBal - ORDER_AMOUNT - PLATFORM_FEE);

        vm.prank(buyer);
        escrow.cancelOrder(orderId);

        // Full refund
        assertEq(usdt.balanceOf(buyer), buyerBal);
    }

    // ========================
    // Seller Timeout Flow
    // ========================

    function test_sellerTimeout_autoExpire() public {
        uint256 buyerBal = usdt.balanceOf(buyer);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        // Seller does nothing for 24+ hours
        vm.warp(block.timestamp + 25 hours);

        // Anyone can trigger auto-expire
        vm.prank(randomUser);
        escrow.autoExpireOrder(orderId);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Expired));
        assertEq(usdt.balanceOf(buyer), buyerBal); // Full refund
    }

    // ========================
    // Buyer Timeout Flow
    // ========================

    function test_buyerTimeout_autoRelease() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        uint256 sellerBal = usdt.balanceOf(seller);
        uint256 treasuryBal = usdt.balanceOf(treasury);

        // Buyer does nothing for 72+ hours
        vm.warp(block.timestamp + 73 hours);

        // Anyone can trigger auto-release
        vm.prank(randomUser);
        escrow.autoReleaseToSeller(orderId);

        assertEq(usdt.balanceOf(seller), sellerBal + ORDER_AMOUNT);
        assertEq(usdt.balanceOf(treasury), treasuryBal + PLATFORM_FEE);
    }

    // ========================
    // Dispute Flow — Buyer Wins
    // ========================

    function test_disputeFlow_buyerWins() public {
        _registerArbitrators();

        // Create order and seller confirms
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        // Buyer opens dispute
        vm.prank(buyer);
        escrow.openDispute(orderId, "QmBuyerEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Disputed));

        // Seller submits evidence
        vm.prank(seller);
        escrow.submitEvidence(orderId, "QmSellerResponse");

        uint256 buyerBal = usdt.balanceOf(buyer);
        uint256 arbBal = usdt.balanceOf(arb);
        uint256 treasuryBal = usdt.balanceOf(treasury);

        // Arbitrator rules for buyer
        vm.prank(arb);
        escrow.resolveDispute(orderId, true);

        o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.ResolvedBuyer));
        assertEq(usdt.balanceOf(buyer), buyerBal + ORDER_AMOUNT - ARB_FEE);
        assertEq(usdt.balanceOf(arb), arbBal + ARB_FEE);
        assertEq(usdt.balanceOf(treasury), treasuryBal + PLATFORM_FEE);
    }

    // ========================
    // Dispute Flow — Seller Wins
    // ========================

    function test_disputeFlow_sellerWins() public {
        _registerArbitrators();

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        vm.prank(buyer);
        escrow.openDispute(orderId, "QmBuyerEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;

        uint256 sellerBal = usdt.balanceOf(seller);
        uint256 arbBal = usdt.balanceOf(arb);
        uint256 treasuryBal = usdt.balanceOf(treasury);

        vm.prank(arb);
        escrow.resolveDispute(orderId, false);

        o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.ResolvedSeller));
        assertEq(usdt.balanceOf(seller), sellerBal + ORDER_AMOUNT - ARB_FEE);
        assertEq(usdt.balanceOf(arb), arbBal + ARB_FEE);
        assertEq(usdt.balanceOf(treasury), treasuryBal + PLATFORM_FEE);
    }

    // ========================
    // Multiple Orders
    // ========================

    function test_multipleOrders_independent() public {
        // Create 3 independent orders
        vm.startPrank(buyer);
        uint256 id0 = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
        uint256 id1 = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, keccak256("product2"));
        uint256 id2 = escrow.createOrder(seller, address(usdc), ORDER_AMOUNT, keccak256("product3"));
        vm.stopPrank();

        // Complete order 0
        vm.prank(seller);
        escrow.sellerConfirmDelivery(id0);
        vm.prank(buyer);
        escrow.buyerConfirmReceived(id0);

        // Cancel order 1
        vm.prank(buyer);
        escrow.cancelOrder(id1);

        // Auto-expire order 2
        vm.warp(block.timestamp + 25 hours);
        escrow.autoExpireOrder(id2);

        // Verify each order independently
        assertEq(uint8(escrow.getOrder(id0).status), uint8(IP2PEscrow.OrderStatus.Completed));
        assertEq(uint8(escrow.getOrder(id1).status), uint8(IP2PEscrow.OrderStatus.Cancelled));
        assertEq(uint8(escrow.getOrder(id2).status), uint8(IP2PEscrow.OrderStatus.Expired));
    }

    // ========================
    // Arbitrator Lifecycle
    // ========================

    function test_arbitratorLifecycle() public {
        // 1. Register
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertTrue(arb.isActive);
        assertEq(arb.reputation, 50);

        // 2. Increase stake
        vm.prank(arbitrator1);
        pool.increaseStake(100e6);

        arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.stake, MIN_STAKE + 100e6);

        // 3. Resolve a dispute (increases reputation)
        // Register arb2 and arb3 (arb1 already registered above)
        vm.prank(arbitrator2);
        pool.register(MIN_STAKE);
        vm.prank(arbitrator3);
        pool.register(MIN_STAKE);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);
        vm.prank(buyer);
        escrow.openDispute(orderId, "QmEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address assigned = o.arbitrator;

        vm.prank(assigned);
        escrow.resolveDispute(orderId, true);

        arb = pool.getArbitrator(assigned);
        assertEq(arb.totalResolved, 1);
        assertGt(arb.totalEarned, 0);

        // 4. Withdraw
        vm.prank(assigned);
        pool.withdraw();

        arb = pool.getArbitrator(assigned);
        assertFalse(arb.isActive);
        assertEq(arb.stake, 0);
    }

    // ========================
    // Dispute from Created (before seller confirms)
    // ========================

    function test_disputeFromCreated() public {
        _registerArbitrators();

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        // Buyer disputes before seller confirms
        vm.prank(buyer);
        escrow.openDispute(orderId, "QmBuyerEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Disputed));

        // Resolve in buyer's favor
        vm.prank(o.arbitrator);
        escrow.resolveDispute(orderId, true);

        o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.ResolvedBuyer));
    }

    // ========================
    // USDC Flow
    // ========================

    function test_fullFlow_withUSDC() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdc), ORDER_AMOUNT, PRODUCT_HASH);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(o.token, address(usdc));

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        uint256 sellerUsdcBefore = usdc.balanceOf(seller);

        vm.prank(buyer);
        escrow.buyerConfirmReceived(orderId);

        // Seller received USDC
        assertEq(usdc.balanceOf(seller), sellerUsdcBefore + ORDER_AMOUNT);
    }

    // ========================
    // Edge: Dispute then try to confirm
    // ========================

    function test_cannotConfirmAfterDispute() public {
        _registerArbitrators();
        uint256 orderId = _createAndConfirm();

        // Open dispute
        vm.prank(buyer);
        escrow.openDispute(orderId, "QmEvidence");

        // Try to confirm — should fail
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: invalid status");
        escrow.buyerConfirmReceived(orderId);
    }

    // ========================
    // Edge: Cannot cancel after seller confirms
    // ========================

    function test_cannotCancelAfterSellerConfirm() public {
        uint256 orderId = _createAndConfirm();

        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: invalid status");
        escrow.cancelOrder(orderId);
    }

    // ========================
    // Edge: Double-resolve prevention
    // ========================

    function test_cannotResolveDisputeTwice() public {
        uint256 orderId = _createAndDispute();
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;

        vm.prank(arb);
        escrow.resolveDispute(orderId, true);

        vm.prank(arb);
        vm.expectRevert("P2PEscrow: not disputed");
        escrow.resolveDispute(orderId, false);
    }
}
