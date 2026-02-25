// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./helpers/BaseTest.sol";
import {ArbitratorPool} from "../src/ArbitratorPool.sol";
import {IArbitratorPool} from "../src/interfaces/IArbitratorPool.sol";

contract ArbitratorPoolTest is BaseTest {
    // Re-declare events for expectEmit
    event ArbitratorRegistered(address indexed arbitrator, uint256 stake);
    event StakeIncreased(address indexed arbitrator, uint256 added, uint256 newTotal);
    event ArbitratorWithdrawn(address indexed arbitrator, uint256 amount);
    event ReputationUpdated(address indexed arbitrator, uint256 newReputation, bool increased);

    // ========================
    // Registration
    // ========================

    function test_register() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.addr, arbitrator1);
        assertEq(arb.stake, MIN_STAKE);
        assertEq(arb.reputation, 50);
        assertEq(arb.totalResolved, 0);
        assertEq(arb.totalEarned, 0);
        assertTrue(arb.isActive);
        assertEq(pool.getActiveArbitratorCount(), 1);
    }

    function test_register_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit ArbitratorRegistered(arbitrator1, MIN_STAKE);

        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);
    }

    function test_register_aboveMinStake() public {
        uint256 largeStake = 10_000e6;
        vm.prank(arbitrator1);
        pool.register(largeStake);

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.stake, largeStake);
    }

    function test_register_revert_belowMinStake() public {
        vm.prank(arbitrator1);
        vm.expectRevert("ArbitratorPool: stake below minimum");
        pool.register(MIN_STAKE - 1);
    }

    function test_register_revert_alreadyActive() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        vm.prank(arbitrator1);
        vm.expectRevert("ArbitratorPool: already active");
        pool.register(MIN_STAKE);
    }

    // ========================
    // Increase Stake
    // ========================

    function test_increaseStake() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        uint256 extra = 100e6;
        vm.prank(arbitrator1);
        pool.increaseStake(extra);

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.stake, MIN_STAKE + extra);
    }

    function test_increaseStake_emitsEvent() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        uint256 extra = 200e6;
        vm.expectEmit(true, false, false, true);
        emit StakeIncreased(arbitrator1, extra, MIN_STAKE + extra);

        vm.prank(arbitrator1);
        pool.increaseStake(extra);
    }

    function test_increaseStake_revert_zeroAmount() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        vm.prank(arbitrator1);
        vm.expectRevert("ArbitratorPool: zero amount");
        pool.increaseStake(0);
    }

    function test_increaseStake_revert_notActive() public {
        vm.prank(arbitrator1);
        vm.expectRevert("ArbitratorPool: not active");
        pool.increaseStake(100e6);
    }

    // ========================
    // Withdraw
    // ========================

    function test_withdraw() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        uint256 balBefore = usdt.balanceOf(arbitrator1);

        vm.prank(arbitrator1);
        pool.withdraw();

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.stake, 0);
        assertFalse(arb.isActive);
        assertEq(usdt.balanceOf(arbitrator1), balBefore + MIN_STAKE);
        assertEq(pool.getActiveArbitratorCount(), 0);
    }

    function test_withdraw_emitsEvent() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        vm.expectEmit(true, false, false, true);
        emit ArbitratorWithdrawn(arbitrator1, MIN_STAKE);

        vm.prank(arbitrator1);
        pool.withdraw();
    }

    function test_withdraw_revert_noStake() public {
        vm.prank(arbitrator1);
        vm.expectRevert("ArbitratorPool: no stake");
        pool.withdraw();
    }

    function test_withdraw_removesFromActiveList() public {
        _registerArbitrators();
        assertEq(pool.getActiveArbitratorCount(), 3);

        vm.prank(arbitrator2);
        pool.withdraw();

        assertEq(pool.getActiveArbitratorCount(), 2);
    }

    // ========================
    // Select Arbitrator
    // ========================

    function test_selectArbitrator() public {
        _registerArbitrators();

        vm.prank(address(escrow));
        address selected = pool.selectArbitrator(buyer, seller);

        // Should be one of the arbitrators
        assertTrue(
            selected == arbitrator1 || selected == arbitrator2 || selected == arbitrator3
        );
        // Should not be buyer or seller
        assertTrue(selected != buyer && selected != seller);
    }

    function test_selectArbitrator_incrementsDisputeCount() public {
        _registerArbitrators();

        vm.prank(address(escrow));
        address selected = pool.selectArbitrator(buyer, seller);

        assertEq(pool.activeDisputeCount(selected), 1);
    }

    function test_selectArbitrator_revert_noArbitrators() public {
        vm.prank(address(escrow));
        vm.expectRevert("ArbitratorPool: no active arbitrators");
        pool.selectArbitrator(buyer, seller);
    }

    function test_selectArbitrator_revert_allConflicted() public {
        // Register only buyer and seller as arbitrators
        usdt.mint(buyer, INITIAL_BALANCE);
        usdt.mint(seller, INITIAL_BALANCE);

        vm.prank(buyer);
        usdt.approve(address(pool), type(uint256).max);
        vm.prank(seller);
        usdt.approve(address(pool), type(uint256).max);

        vm.prank(buyer);
        pool.register(MIN_STAKE);
        vm.prank(seller);
        pool.register(MIN_STAKE);

        vm.prank(address(escrow));
        vm.expectRevert("ArbitratorPool: no eligible arbitrators");
        pool.selectArbitrator(buyer, seller);
    }

    function test_selectArbitrator_revert_notEscrow() public {
        _registerArbitrators();

        vm.prank(randomUser);
        vm.expectRevert("ArbitratorPool: caller is not escrow");
        pool.selectArbitrator(buyer, seller);
    }

    // ========================
    // Update Reputation
    // ========================

    function test_updateReputation_increase() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        vm.prank(address(escrow));
        pool.updateReputation(arbitrator1, true);

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.reputation, 52); // 50 + 2
    }

    function test_updateReputation_decrease() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        vm.prank(address(escrow));
        pool.updateReputation(arbitrator1, false);

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.reputation, 45); // 50 - 5
    }

    function test_updateReputation_cappedAt100() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        // Increase reputation many times
        for (uint256 i = 0; i < 30; i++) {
            vm.prank(address(escrow));
            pool.updateReputation(arbitrator1, true);
        }

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.reputation, 100);
    }

    function test_updateReputation_flooredAtZero() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        // Decrease reputation many times — after enough decreases it should deactivate
        for (uint256 i = 0; i < 10; i++) {
            IArbitratorPool.Arbitrator memory a = pool.getArbitrator(arbitrator1);
            if (!a.isActive) break;
            vm.prank(address(escrow));
            pool.updateReputation(arbitrator1, false);
        }

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertTrue(arb.reputation < 10);
        assertFalse(arb.isActive);
    }

    function test_updateReputation_deactivatesBelowThreshold() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        // rep: 50 → 45 → 40 → 35 → 30 → 25 → 20 → 15 → 10 → 5 (deactivated)
        for (uint256 i = 0; i < 9; i++) {
            vm.prank(address(escrow));
            pool.updateReputation(arbitrator1, false);
        }

        IArbitratorPool.Arbitrator memory arb = pool.getArbitrator(arbitrator1);
        assertEq(arb.reputation, 5);
        assertFalse(arb.isActive);
        assertEq(pool.getActiveArbitratorCount(), 0);
    }

    function test_updateReputation_revert_notEscrow() public {
        vm.prank(arbitrator1);
        pool.register(MIN_STAKE);

        vm.prank(randomUser);
        vm.expectRevert("ArbitratorPool: caller is not escrow");
        pool.updateReputation(arbitrator1, true);
    }

    // ========================
    // Admin
    // ========================

    function test_setEscrowContract() public {
        address newEscrow = makeAddr("newEscrow");
        vm.prank(owner);
        pool.setEscrowContract(newEscrow);
        assertEq(pool.escrowContract(), newEscrow);
    }

    function test_setEscrowContract_revert_notOwner() public {
        vm.prank(randomUser);
        vm.expectRevert();
        pool.setEscrowContract(makeAddr("x"));
    }

    function test_setEscrowContract_revert_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("ArbitratorPool: zero address");
        pool.setEscrowContract(address(0));
    }

    // ========================
    // Dispute Count
    // ========================

    function test_withdraw_revert_activeDisputes() public {
        _registerArbitrators();

        // Create an order and open dispute to assign an arbitrator
        uint256 orderId = _createAndConfirm();
        vm.prank(buyer);
        escrow.openDispute(orderId, "QmEvidence");

        // Find which arbitrator was assigned
        address assigned = escrow.getOrder(orderId).arbitrator;

        // That arbitrator should not be able to withdraw
        vm.prank(assigned);
        vm.expectRevert("ArbitratorPool: active disputes pending");
        pool.withdraw();
    }
}
