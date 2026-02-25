// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./helpers/BaseTest.sol";
import {P2PEscrow} from "../src/P2PEscrow.sol";
import {IP2PEscrow} from "../src/interfaces/IP2PEscrow.sol";
import {IArbitratorPool} from "../src/interfaces/IArbitratorPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2PEscrowTest is BaseTest {
    // Re-declare events for expectEmit
    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, address token, uint256 amount, bytes32 productHash);
    event SellerConfirmed(uint256 indexed orderId, uint256 confirmedAt);
    event OrderCompleted(uint256 indexed orderId, uint256 amountToSeller, uint256 platformFee);
    event OrderCancelled(uint256 indexed orderId, address cancelledBy);
    event OrderExpired(uint256 indexed orderId, uint8 reason);
    event DisputeOpened(uint256 indexed orderId, address indexed openedBy, string evidenceHash);
    event EvidenceSubmitted(uint256 indexed orderId, address indexed submitter, string evidenceHash);
    event DisputeResolved(uint256 indexed orderId, address indexed arbitrator, bool favorBuyer, uint256 arbitrationFee);

    // ========================
    // createOrder
    // ========================

    function test_createOrder() public {
        uint256 buyerBalBefore = usdt.balanceOf(buyer);

        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        assertEq(orderId, 0);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(o.buyer, buyer);
        assertEq(o.seller, seller);
        assertEq(o.token, address(usdt));
        assertEq(o.amount, ORDER_AMOUNT);
        assertEq(o.platformFee, PLATFORM_FEE);
        assertEq(o.productHash, PRODUCT_HASH);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Created));
        assertEq(o.arbitrator, address(0));

        // Buyer paid amount + fee
        assertEq(usdt.balanceOf(buyer), buyerBalBefore - ORDER_AMOUNT - PLATFORM_FEE);
        // Escrow holds funds
        assertEq(usdt.balanceOf(address(escrow)), ORDER_AMOUNT + PLATFORM_FEE);
    }

    function test_createOrder_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit OrderCreated(0, buyer, seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        vm.prank(buyer);
        escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
    }

    function test_createOrder_incrementsId() public {
        vm.startPrank(buyer);
        uint256 id0 = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
        uint256 id1 = escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
        vm.stopPrank();
        assertEq(id0, 0);
        assertEq(id1, 1);
    }

    function test_createOrder_withUSDC() public {
        vm.prank(buyer);
        uint256 orderId = escrow.createOrder(seller, address(usdc), ORDER_AMOUNT, PRODUCT_HASH);
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(o.token, address(usdc));
    }

    function test_createOrder_revert_unsupportedToken() public {
        address fakeToken = makeAddr("fakeToken");
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: unsupported token");
        escrow.createOrder(seller, fakeToken, ORDER_AMOUNT, PRODUCT_HASH);
    }

    function test_createOrder_revert_amountTooLow() public {
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: amount too low");
        escrow.createOrder(seller, address(usdt), 0, PRODUCT_HASH);
    }

    function test_createOrder_revert_buyerIsSeller() public {
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: buyer is seller");
        escrow.createOrder(buyer, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
    }

    function test_createOrder_revert_zeroSeller() public {
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: zero seller");
        escrow.createOrder(address(0), address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
    }

    function test_createOrder_revert_whenPaused() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(buyer);
        vm.expectRevert();
        escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
    }

    // ========================
    // sellerConfirmDelivery
    // ========================

    function test_sellerConfirmDelivery() public {
        uint256 orderId = _createOrder();

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.SellerConfirmed));
        assertGt(o.sellerConfirmedAt, 0);
    }

    function test_sellerConfirmDelivery_emitsEvent() public {
        uint256 orderId = _createOrder();

        vm.expectEmit(true, false, false, true);
        emit SellerConfirmed(orderId, block.timestamp);

        vm.prank(seller);
        escrow.sellerConfirmDelivery(orderId);
    }

    function test_sellerConfirmDelivery_revert_notSeller() public {
        uint256 orderId = _createOrder();
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: not seller");
        escrow.sellerConfirmDelivery(orderId);
    }

    function test_sellerConfirmDelivery_revert_invalidStatus() public {
        uint256 orderId = _createAndConfirm();
        vm.prank(seller);
        vm.expectRevert("P2PEscrow: invalid status");
        escrow.sellerConfirmDelivery(orderId);
    }

    // ========================
    // buyerConfirmReceived
    // ========================

    function test_buyerConfirmReceived() public {
        uint256 orderId = _createAndConfirm();

        uint256 sellerBalBefore = usdt.balanceOf(seller);
        uint256 treasuryBalBefore = usdt.balanceOf(treasury);

        vm.prank(buyer);
        escrow.buyerConfirmReceived(orderId);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Completed));
        assertEq(usdt.balanceOf(seller), sellerBalBefore + ORDER_AMOUNT);
        assertEq(usdt.balanceOf(treasury), treasuryBalBefore + PLATFORM_FEE);
        assertEq(usdt.balanceOf(address(escrow)), 0);
    }

    function test_buyerConfirmReceived_emitsEvent() public {
        uint256 orderId = _createAndConfirm();

        vm.expectEmit(true, false, false, true);
        emit OrderCompleted(orderId, ORDER_AMOUNT, PLATFORM_FEE);

        vm.prank(buyer);
        escrow.buyerConfirmReceived(orderId);
    }

    function test_buyerConfirmReceived_revert_notBuyer() public {
        uint256 orderId = _createAndConfirm();
        vm.prank(seller);
        vm.expectRevert("P2PEscrow: not buyer");
        escrow.buyerConfirmReceived(orderId);
    }

    function test_buyerConfirmReceived_revert_invalidStatus() public {
        uint256 orderId = _createOrder();
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: invalid status");
        escrow.buyerConfirmReceived(orderId);
    }

    // ========================
    // cancelOrder
    // ========================

    function test_cancelOrder() public {
        uint256 orderId = _createOrder();
        uint256 buyerBalBefore = usdt.balanceOf(buyer);

        vm.prank(buyer);
        escrow.cancelOrder(orderId);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Cancelled));
        assertEq(usdt.balanceOf(buyer), buyerBalBefore + ORDER_AMOUNT + PLATFORM_FEE);
        assertEq(usdt.balanceOf(address(escrow)), 0);
    }

    function test_cancelOrder_emitsEvent() public {
        uint256 orderId = _createOrder();

        vm.expectEmit(true, false, false, true);
        emit OrderCancelled(orderId, buyer);

        vm.prank(buyer);
        escrow.cancelOrder(orderId);
    }

    function test_cancelOrder_revert_notBuyer() public {
        uint256 orderId = _createOrder();
        vm.prank(seller);
        vm.expectRevert("P2PEscrow: not buyer");
        escrow.cancelOrder(orderId);
    }

    function test_cancelOrder_revert_afterSellerConfirm() public {
        uint256 orderId = _createAndConfirm();
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: invalid status");
        escrow.cancelOrder(orderId);
    }

    // ========================
    // openDispute
    // ========================

    function test_openDispute_byBuyer_fromCreated() public {
        _registerArbitrators();
        uint256 orderId = _createOrder();

        vm.prank(buyer);
        escrow.openDispute(orderId, "QmBuyerEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Disputed));
        assertTrue(o.arbitrator != address(0));
        assertGt(o.disputeDeadline, 0);
        assertEq(o.arbitrationFee, ARB_FEE);
        assertEq(o.evidenceBuyer, "QmBuyerEvidence");
    }

    function test_openDispute_bySeller_fromSellerConfirmed() public {
        _registerArbitrators();
        uint256 orderId = _createAndConfirm();

        vm.prank(seller);
        escrow.openDispute(orderId, "QmSellerEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Disputed));
        assertEq(o.evidenceSeller, "QmSellerEvidence");
    }

    function test_openDispute_emitsEvent() public {
        _registerArbitrators();
        uint256 orderId = _createOrder();

        vm.expectEmit(true, true, false, true);
        emit DisputeOpened(orderId, buyer, "QmEvidence");

        vm.prank(buyer);
        escrow.openDispute(orderId, "QmEvidence");
    }

    function test_openDispute_revert_notParty() public {
        _registerArbitrators();
        uint256 orderId = _createOrder();

        vm.prank(randomUser);
        vm.expectRevert("P2PEscrow: not buyer or seller");
        escrow.openDispute(orderId, "QmEvidence");
    }

    function test_openDispute_revert_alreadyCompleted() public {
        _registerArbitrators();
        uint256 orderId = _createAndConfirm();

        vm.prank(buyer);
        escrow.buyerConfirmReceived(orderId);

        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: invalid status");
        escrow.openDispute(orderId, "QmEvidence");
    }

    // ========================
    // submitEvidence
    // ========================

    function test_submitEvidence_buyer() public {
        uint256 orderId = _createAndDispute();

        vm.prank(buyer);
        escrow.submitEvidence(orderId, "QmUpdatedBuyerEvidence");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(o.evidenceBuyer, "QmUpdatedBuyerEvidence");
    }

    function test_submitEvidence_seller() public {
        uint256 orderId = _createAndDispute();

        vm.prank(seller);
        escrow.submitEvidence(orderId, "QmSellerResponse");

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(o.evidenceSeller, "QmSellerResponse");
    }

    function test_submitEvidence_emitsEvent() public {
        uint256 orderId = _createAndDispute();

        vm.expectEmit(true, true, false, true);
        emit EvidenceSubmitted(orderId, seller, "QmSellerHash");

        vm.prank(seller);
        escrow.submitEvidence(orderId, "QmSellerHash");
    }

    function test_submitEvidence_revert_notDisputed() public {
        uint256 orderId = _createOrder();
        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: not disputed");
        escrow.submitEvidence(orderId, "QmHash");
    }

    function test_submitEvidence_revert_notParty() public {
        uint256 orderId = _createAndDispute();
        vm.prank(randomUser);
        vm.expectRevert("P2PEscrow: not buyer or seller");
        escrow.submitEvidence(orderId, "QmHash");
    }

    // ========================
    // resolveDispute
    // ========================

    function test_resolveDispute_favorBuyer() public {
        uint256 orderId = _createAndDispute();
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;

        uint256 buyerBalBefore = usdt.balanceOf(buyer);
        uint256 arbBalBefore = usdt.balanceOf(arb);
        uint256 treasuryBalBefore = usdt.balanceOf(treasury);

        vm.prank(arb);
        escrow.resolveDispute(orderId, true);

        o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.ResolvedBuyer));
        assertEq(usdt.balanceOf(buyer), buyerBalBefore + ORDER_AMOUNT - ARB_FEE);
        assertEq(usdt.balanceOf(arb), arbBalBefore + ARB_FEE);
        assertEq(usdt.balanceOf(treasury), treasuryBalBefore + PLATFORM_FEE);
        assertEq(usdt.balanceOf(address(escrow)), 0);
    }

    function test_resolveDispute_favorSeller() public {
        uint256 orderId = _createAndDispute();
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;

        uint256 sellerBalBefore = usdt.balanceOf(seller);
        uint256 arbBalBefore = usdt.balanceOf(arb);

        vm.prank(arb);
        escrow.resolveDispute(orderId, false);

        o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.ResolvedSeller));
        assertEq(usdt.balanceOf(seller), sellerBalBefore + ORDER_AMOUNT - ARB_FEE);
        assertEq(usdt.balanceOf(arb), arbBalBefore + ARB_FEE);
    }

    function test_resolveDispute_emitsEvent() public {
        uint256 orderId = _createAndDispute();
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;

        vm.expectEmit(true, true, false, true);
        emit DisputeResolved(orderId, arb, true, ARB_FEE);

        vm.prank(arb);
        escrow.resolveDispute(orderId, true);
    }

    function test_resolveDispute_updatesArbitratorStats() public {
        uint256 orderId = _createAndDispute();
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        address arb = o.arbitrator;

        vm.prank(arb);
        escrow.resolveDispute(orderId, true);

        IArbitratorPool.Arbitrator memory arbData = pool.getArbitrator(arb);
        assertEq(arbData.totalResolved, 1);
        assertEq(arbData.totalEarned, ARB_FEE);
        assertEq(arbData.reputation, 52); // 50 + 2
    }

    function test_resolveDispute_revert_notArbitrator() public {
        uint256 orderId = _createAndDispute();

        vm.prank(buyer);
        vm.expectRevert("P2PEscrow: not arbitrator");
        escrow.resolveDispute(orderId, true);
    }

    function test_resolveDispute_revert_notDisputed() public {
        _registerArbitrators();
        uint256 orderId = _createOrder();

        vm.prank(arbitrator1);
        vm.expectRevert("P2PEscrow: not arbitrator");
        escrow.resolveDispute(orderId, true);
    }

    // ========================
    // autoExpireOrder
    // ========================

    function test_autoExpireOrder() public {
        uint256 orderId = _createOrder();
        uint256 buyerBalBefore = usdt.balanceOf(buyer);

        // Warp past seller timeout
        vm.warp(block.timestamp + 24 hours + 1);

        escrow.autoExpireOrder(orderId);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Expired));
        assertEq(usdt.balanceOf(buyer), buyerBalBefore + ORDER_AMOUNT + PLATFORM_FEE);
    }

    function test_autoExpireOrder_emitsEvent() public {
        uint256 orderId = _createOrder();
        vm.warp(block.timestamp + 24 hours + 1);

        vm.expectEmit(true, false, false, true);
        emit OrderExpired(orderId, 0);

        escrow.autoExpireOrder(orderId);
    }

    function test_autoExpireOrder_revert_tooEarly() public {
        uint256 orderId = _createOrder();
        vm.warp(block.timestamp + 12 hours);

        vm.expectRevert("P2PEscrow: timeout not reached");
        escrow.autoExpireOrder(orderId);
    }

    function test_autoExpireOrder_revert_wrongStatus() public {
        uint256 orderId = _createAndConfirm();
        vm.warp(block.timestamp + 24 hours + 1);

        vm.expectRevert("P2PEscrow: invalid status");
        escrow.autoExpireOrder(orderId);
    }

    // ========================
    // autoReleaseToSeller
    // ========================

    function test_autoReleaseToSeller() public {
        uint256 orderId = _createAndConfirm();
        uint256 sellerBalBefore = usdt.balanceOf(seller);
        uint256 treasuryBalBefore = usdt.balanceOf(treasury);

        // Warp past confirm window
        vm.warp(block.timestamp + 72 hours + 1);

        escrow.autoReleaseToSeller(orderId);

        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Expired));
        assertEq(usdt.balanceOf(seller), sellerBalBefore + ORDER_AMOUNT);
        assertEq(usdt.balanceOf(treasury), treasuryBalBefore + PLATFORM_FEE);
    }

    function test_autoReleaseToSeller_emitsEvent() public {
        uint256 orderId = _createAndConfirm();
        vm.warp(block.timestamp + 72 hours + 1);

        vm.expectEmit(true, false, false, true);
        emit OrderExpired(orderId, 1);

        escrow.autoReleaseToSeller(orderId);
    }

    function test_autoReleaseToSeller_revert_tooEarly() public {
        uint256 orderId = _createAndConfirm();
        vm.warp(block.timestamp + 48 hours);

        vm.expectRevert("P2PEscrow: window not reached");
        escrow.autoReleaseToSeller(orderId);
    }

    function test_autoReleaseToSeller_revert_wrongStatus() public {
        uint256 orderId = _createOrder();
        vm.warp(block.timestamp + 72 hours + 1);

        vm.expectRevert("P2PEscrow: invalid status");
        escrow.autoReleaseToSeller(orderId);
    }

    // ========================
    // Admin Functions
    // ========================

    function test_setSupportedToken() public {
        address newToken = makeAddr("newToken");
        vm.prank(owner);
        escrow.setSupportedToken(newToken, true);
        assertTrue(escrow.supportedTokens(newToken));

        vm.prank(owner);
        escrow.setSupportedToken(newToken, false);
        assertFalse(escrow.supportedTokens(newToken));
    }

    function test_setSupportedToken_revert_notOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        escrow.setSupportedToken(makeAddr("t"), true);
    }

    function test_setTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        escrow.setTreasury(newTreasury);
        assertEq(escrow.treasury(), newTreasury);
    }

    function test_setTreasury_revert_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("P2PEscrow: zero treasury");
        escrow.setTreasury(address(0));
    }

    function test_setArbitratorPool() public {
        address newPool = makeAddr("newPool");
        vm.prank(owner);
        escrow.setArbitratorPool(newPool);
    }

    function test_pause_unpause() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(buyer);
        vm.expectRevert();
        escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);

        vm.prank(owner);
        escrow.unpause();

        // Should work again
        vm.prank(buyer);
        escrow.createOrder(seller, address(usdt), ORDER_AMOUNT, PRODUCT_HASH);
    }

    function test_pause_revert_notOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        escrow.pause();
    }

    // ========================
    // autoExpire/autoRelease still work when paused (no whenNotPaused)
    // ========================

    function test_autoExpire_worksWhenPaused() public {
        uint256 orderId = _createOrder();
        vm.warp(block.timestamp + 24 hours + 1);

        vm.prank(owner);
        escrow.pause();

        // autoExpireOrder has no whenNotPaused, so it should work
        escrow.autoExpireOrder(orderId);
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Expired));
    }

    function test_autoRelease_worksWhenPaused() public {
        uint256 orderId = _createAndConfirm();
        vm.warp(block.timestamp + 72 hours + 1);

        vm.prank(owner);
        escrow.pause();

        escrow.autoReleaseToSeller(orderId);
        IP2PEscrow.Order memory o = escrow.getOrder(orderId);
        assertEq(uint8(o.status), uint8(IP2PEscrow.OrderStatus.Expired));
    }
}
