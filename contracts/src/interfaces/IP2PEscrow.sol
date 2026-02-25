// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IP2PEscrow {
    enum OrderStatus {
        Created,
        SellerConfirmed,
        Completed,
        Disputed,
        ResolvedBuyer,
        ResolvedSeller,
        Cancelled,
        Expired
    }

    struct Order {
        uint256 id;
        address buyer;
        address seller;
        address arbitrator;
        address token;
        uint256 amount;
        uint256 platformFee;
        uint256 arbitrationFee;
        OrderStatus status;
        bytes32 productHash;
        uint256 createdAt;
        uint256 sellerConfirmedAt;
        uint256 disputeDeadline;
        string evidenceBuyer;
        string evidenceSeller;
    }

    // --- Events ---

    event OrderCreated(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        bytes32 productHash
    );

    event SellerConfirmed(uint256 indexed orderId, uint256 confirmedAt);

    event OrderCompleted(uint256 indexed orderId, uint256 amountToSeller, uint256 platformFee);

    event OrderCancelled(uint256 indexed orderId, address cancelledBy);

    event OrderExpired(uint256 indexed orderId, uint8 reason);

    event DisputeOpened(uint256 indexed orderId, address indexed openedBy, string evidenceHash);

    event EvidenceSubmitted(uint256 indexed orderId, address indexed submitter, string evidenceHash);

    event DisputeResolved(uint256 indexed orderId, address indexed arbitrator, bool favorBuyer, uint256 arbitrationFee);

    // --- Buyer Functions ---

    /// @notice Create a new escrow order, locking buyer funds
    /// @param seller Seller wallet address
    /// @param token Payment token address (USDT or USDC)
    /// @param amount Product price in token units
    /// @param productHash SHA-256 hash of the product for integrity verification
    function createOrder(address seller, address token, uint256 amount, bytes32 productHash) external returns (uint256);

    /// @notice Buyer confirms receipt of product, releasing funds
    /// @param orderId The order to confirm
    function buyerConfirmReceived(uint256 orderId) external;

    /// @notice Buyer cancels order before seller confirms delivery
    /// @param orderId The order to cancel
    function cancelOrder(uint256 orderId) external;

    // --- Seller Functions ---

    /// @notice Seller confirms delivery of product
    /// @param orderId The order to confirm delivery for
    function sellerConfirmDelivery(uint256 orderId) external;

    // --- Shared Functions ---

    /// @notice Either party opens a dispute
    /// @param orderId The order to dispute
    /// @param evidenceHash IPFS hash of encrypted evidence
    function openDispute(uint256 orderId, string calldata evidenceHash) external;

    /// @notice Submit additional evidence for a dispute
    /// @param orderId The disputed order
    /// @param ipfsHash IPFS hash of encrypted evidence
    function submitEvidence(uint256 orderId, string calldata ipfsHash) external;

    // --- Arbitrator Functions ---

    /// @notice Arbitrator resolves a dispute
    /// @param orderId The disputed order
    /// @param favorBuyer True to rule in buyer's favor, false for seller
    function resolveDispute(uint256 orderId, bool favorBuyer) external;

    // --- Automation Functions ---

    /// @notice Auto-expire order if seller doesn't confirm within timeout
    /// @param orderId The order to expire
    function autoExpireOrder(uint256 orderId) external;

    /// @notice Auto-release funds to seller if buyer doesn't act within window
    /// @param orderId The order to auto-release
    function autoReleaseToSeller(uint256 orderId) external;

    // --- View Functions ---

    /// @notice Get order details
    /// @param orderId The order ID
    function getOrder(uint256 orderId) external view returns (Order memory);
}
