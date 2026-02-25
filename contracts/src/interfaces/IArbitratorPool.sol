// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbitratorPool {
    struct Arbitrator {
        address addr;
        uint256 stake;
        uint256 reputation;
        uint256 totalResolved;
        uint256 totalEarned;
        bool isActive;
    }

    event ArbitratorRegistered(address indexed arbitrator, uint256 stake);
    event StakeIncreased(address indexed arbitrator, uint256 added, uint256 newTotal);
    event ArbitratorWithdrawn(address indexed arbitrator, uint256 amount);
    event ReputationUpdated(address indexed arbitrator, uint256 newReputation, bool increased);

    /// @notice Register as an arbitrator by staking tokens
    /// @param stakeAmount Amount of tokens to stake (>= MIN_STAKE)
    function register(uint256 stakeAmount) external;

    /// @notice Increase stake on existing position
    /// @param amount Additional tokens to stake
    function increaseStake(uint256 amount) external;

    /// @notice Withdraw entire stake and deactivate
    function withdraw() external;

    /// @notice Select a random arbitrator weighted by reputation
    /// @param buyer Buyer address (for conflict-of-interest check)
    /// @param seller Seller address (for conflict-of-interest check)
    /// @return Selected arbitrator address
    function selectArbitrator(address buyer, address seller) external returns (address);

    /// @notice Update arbitrator reputation after dispute resolution
    /// @param arbitrator Arbitrator address
    /// @param consistent Whether the resolution was consistent with evidence
    function updateReputation(address arbitrator, bool consistent) external;

    /// @notice Get arbitrator info
    /// @param arbitrator Arbitrator address
    function getArbitrator(address arbitrator) external view returns (Arbitrator memory);

    /// @notice Get count of active arbitrators
    function getActiveArbitratorCount() external view returns (uint256);
}
