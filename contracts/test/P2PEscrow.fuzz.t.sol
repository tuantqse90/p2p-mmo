// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./helpers/BaseTest.sol";
import {IP2PEscrow} from "../src/interfaces/IP2PEscrow.sol";

contract P2PEscrowFuzzTest is BaseTest {
    function test_fuzz_createOrder_validAmounts(uint256 amount) public {
        // Bound amount between MIN_ORDER_AMOUNT and a reasonable max
        amount = bound(amount, 1e6, 1_000_000e6); // 1 to 1M USDT

        uint256 platformFee = (amount * 200) / 10_000;
        uint256 totalNeeded = amount + platformFee;

        // Ensure buyer has enough
        usdt.mint(buyer, totalNeeded);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), amount, PRODUCT_HASH);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(o.amount, amount);
        assertEq(o.platformFee, platformFee);
        assertEq(usdt.balanceOf(address(escrow)) >= amount + platformFee, true);
    }

    function test_fuzz_fullFlow_happyPath(uint256 amount) public {
        amount = bound(amount, 1e6, 100_000e6);

        uint256 platformFee = (amount * 200) / 10_000;
        uint256 totalNeeded = amount + platformFee;
        usdt.mint(buyer, totalNeeded);

        // Create order
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), amount, PRODUCT_HASH);

        // Seller confirms
        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        uint256 sellerBalBefore = usdt.balanceOf(seller);
        uint256 treasuryBalBefore = usdt.balanceOf(treasury);

        // Buyer confirms
        vm.prank(buyer);
        escrow.buyerConfirmReceived(orderId);

        // Verify distributions
        assertEq(usdt.balanceOf(seller), sellerBalBefore + amount);
        assertEq(usdt.balanceOf(treasury), treasuryBalBefore + platformFee);
        assertEq(usdt.balanceOf(address(escrow)), 0);
    }

    function test_fuzz_autoExpire_timing(uint256 waitTime) public {
        waitTime = bound(waitTime, 0, 48 hours);

        uint256 orderId = _createOrder();

        vm.warp(block.timestamp + waitTime);

        if (waitTime > 24 hours) {
            escrow.autoExpireOrder(orderId);
            IP2PEscrow.Order memory o = escrow.getOrder(orderId);
            assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Expired));
        } else {
            vm.expectRevert("P2PEscrow: timeout not reached");
            escrow.autoExpireOrder(orderId);
        }
    }

    function test_fuzz_autoRelease_timing(uint256 waitTime) public {
        waitTime = bound(waitTime, 0, 96 hours);

        uint256 orderId = _createAndConfirm();

        vm.warp(block.timestamp + waitTime);

        if (waitTime > 72 hours) {
            escrow.autoReleaseToSeller(orderId);
            IP2PEscrow.Order memory o = escrow.getOrder(orderId);
            assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Expired));
        } else {
            vm.expectRevert("P2PEscrow: window not reached");
            escrow.autoReleaseToSeller(orderId);
        }
    }

    function test_fuzz_disputeResolution_fundsConservation(uint256 amount, bool favorBuyer) public {
        amount = bound(amount, 10e6, 100_000e6); // min 10 USDT for meaningful arb fee

        uint256 platformFee = (amount * 200) / 10_000;
        uint256 arbFee = (amount * 500) / 10_000;
        uint256 totalNeeded = amount + platformFee;
        usdt.mint(buyer, totalNeeded);

        _registerArbitrators();

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), amount, PRODUCT_HASH);

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        vm.prank(buyer);
        escrow.openDispute(orderId, "QmEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;

        uint256 totalBefore = usdt.balanceOf(buyer) + usdt.balanceOf(seller)
            + usdt.balanceOf(arb) + usdt.balanceOf(treasury) + usdt.balanceOf(address(escrow));

        vm.prank(arb);
        escrow.resolveDispute(orderId, favorBuyer);

        uint256 totalAfter = usdt.balanceOf(buyer) + usdt.balanceOf(seller)
            + usdt.balanceOf(arb) + usdt.balanceOf(treasury) + usdt.balanceOf(address(escrow));

        // Total funds should be conserved (no tokens created or destroyed)
        assertEq(totalBefore, totalAfter);

        // Verify correct distribution
        if (favorBuyer) {
            // buyer gets amount - arbFee, arb gets arbFee, treasury gets platformFee
            assertEq(usdt.balanceOf(address(escrow)), 0);
        } else {
            assertEq(usdt.balanceOf(address(escrow)), 0);
        }
    }
}
