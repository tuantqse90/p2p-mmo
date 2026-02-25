// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IArbitratorPool} from "./interfaces/IArbitratorPool.sol";

/// @title ArbitratorPool
/// @notice Manages arbitrator registration, staking, weighted random selection, and reputation
contract ArbitratorPool is IArbitratorPool, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MIN_STAKE = 500e6; // 500 USDT (6 decimals)
    uint256 public constant INITIAL_REPUTATION = 50;
    uint256 public constant MAX_REPUTATION = 100;
    uint256 public constant MIN_ACTIVE_REPUTATION = 10;
    uint256 public constant REPUTATION_INCREASE = 2;
    uint256 public constant REPUTATION_DECREASE = 5;

    IERC20 public immutable stakeToken;
    address public escrowContract;

    mapping(address => Arbitrator) public arbitrators;
    address[] public activeArbitrators;
    mapping(address => uint256) private _activeIndex; // 1-indexed for existence check
    mapping(address => uint256) public activeDisputeCount;

    modifier onlyEscrow() {
        require(msg.sender == escrowContract, "ArbitratorPool: caller is not escrow");
        _;
    }

    constructor(address _stakeToken, address _owner) Ownable(_owner) {
        require(_stakeToken != address(0), "ArbitratorPool: zero token address");
        stakeToken = IERC20(_stakeToken);
    }

    /// @notice Set the escrow contract address (one-time or owner-only update)
    function setEscrowContract(address _escrow) external onlyOwner {
        require(_escrow != address(0), "ArbitratorPool: zero address");
        escrowContract = _escrow;
    }

    /// @inheritdoc IArbitratorPool
    function register(uint256 stakeAmount) external nonReentrant {
        require(stakeAmount >= MIN_STAKE, "ArbitratorPool: stake below minimum");
        require(!arbitrators[msg.sender].isActive, "ArbitratorPool: already active");
        require(arbitrators[msg.sender].stake == 0, "ArbitratorPool: already registered, use increaseStake");

        stakeToken.safeTransferFrom(msg.sender, address(this), stakeAmount);

        arbitrators[msg.sender] = Arbitrator({
            addr: msg.sender,
            stake: stakeAmount,
            reputation: INITIAL_REPUTATION,
            totalResolved: 0,
            totalEarned: 0,
            isActive: true
        });

        activeArbitrators.push(msg.sender);
        _activeIndex[msg.sender] = activeArbitrators.length; // 1-indexed

        emit ArbitratorRegistered(msg.sender, stakeAmount);
    }

    /// @inheritdoc IArbitratorPool
    function increaseStake(uint256 amount) external nonReentrant {
        require(amount > 0, "ArbitratorPool: zero amount");
        Arbitrator storage arb = arbitrators[msg.sender];
        require(arb.isActive, "ArbitratorPool: not active");

        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        arb.stake += amount;

        emit StakeIncreased(msg.sender, amount, arb.stake);
    }

    /// @inheritdoc IArbitratorPool
    function withdraw() external nonReentrant {
        Arbitrator storage arb = arbitrators[msg.sender];
        require(arb.stake > 0, "ArbitratorPool: no stake");
        require(activeDisputeCount[msg.sender] == 0, "ArbitratorPool: active disputes pending");

        uint256 amount = arb.stake;
        arb.stake = 0;
        arb.isActive = false;

        _removeFromActive(msg.sender);

        stakeToken.safeTransfer(msg.sender, amount);

        emit ArbitratorWithdrawn(msg.sender, amount);
    }

    /// @inheritdoc IArbitratorPool
    function selectArbitrator(address buyer, address seller) external onlyEscrow returns (address) {
        uint256 count = activeArbitrators.length;
        require(count > 0, "ArbitratorPool: no active arbitrators");

        // Build eligible list excluding buyer and seller (conflict-of-interest check)
        uint256 totalWeight = 0;
        uint256 eligibleCount = 0;

        // First pass: count eligible and total weight
        for (uint256 i = 0; i < count; i++) {
            address arb = activeArbitrators[i];
            if (arb != buyer && arb != seller) {
                totalWeight += arbitrators[arb].reputation;
                eligibleCount++;
            }
        }

        require(eligibleCount > 0, "ArbitratorPool: no eligible arbitrators");
        require(totalWeight > 0, "ArbitratorPool: zero total weight");

        // Weighted random selection using block data
        uint256 random = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, buyer, seller))) % totalWeight;

        uint256 cumulative = 0;
        for (uint256 i = 0; i < count; i++) {
            address arb = activeArbitrators[i];
            if (arb != buyer && arb != seller) {
                cumulative += arbitrators[arb].reputation;
                if (random < cumulative) {
                    activeDisputeCount[arb]++;
                    return arb;
                }
            }
        }

        // Fallback: return last eligible (should not reach here)
        revert("ArbitratorPool: selection failed");
    }

    /// @inheritdoc IArbitratorPool
    function updateReputation(address arbitrator, bool consistent) external onlyEscrow {
        Arbitrator storage arb = arbitrators[arbitrator];
        require(arb.isActive, "ArbitratorPool: not active");

        if (consistent) {
            uint256 newRep = arb.reputation + REPUTATION_INCREASE;
            arb.reputation = newRep > MAX_REPUTATION ? MAX_REPUTATION : newRep;
        } else {
            if (arb.reputation <= REPUTATION_DECREASE) {
                arb.reputation = 0;
            } else {
                arb.reputation -= REPUTATION_DECREASE;
            }
        }

        // Deactivate if reputation drops below threshold
        if (arb.reputation < MIN_ACTIVE_REPUTATION) {
            arb.isActive = false;
            _removeFromActive(arbitrator);
        }

        emit ReputationUpdated(arbitrator, arb.reputation, consistent);
    }

    /// @notice Called by escrow when a dispute is resolved to decrement active count
    function decrementDisputeCount(address arbitrator) external onlyEscrow {
        if (activeDisputeCount[arbitrator] > 0) {
            activeDisputeCount[arbitrator]--;
        }
    }

    /// @notice Record earnings for an arbitrator
    function recordEarnings(address arbitrator, uint256 amount) external onlyEscrow {
        arbitrators[arbitrator].totalResolved++;
        arbitrators[arbitrator].totalEarned += amount;
    }

    /// @inheritdoc IArbitratorPool
    function getArbitrator(address arbitrator) external view returns (Arbitrator memory) {
        return arbitrators[arbitrator];
    }

    /// @inheritdoc IArbitratorPool
    function getActiveArbitratorCount() external view returns (uint256) {
        return activeArbitrators.length;
    }

    // --- Internal ---

    function _removeFromActive(address arb) internal {
        uint256 idx = _activeIndex[arb];
        if (idx == 0) return; // not in active list

        uint256 lastIdx = activeArbitrators.length;
        if (idx != lastIdx) {
            address lastArb = activeArbitrators[lastIdx - 1];
            activeArbitrators[idx - 1] = lastArb;
            _activeIndex[lastArb] = idx;
        }

        activeArbitrators.pop();
        _activeIndex[arb] = 0;
    }
}
