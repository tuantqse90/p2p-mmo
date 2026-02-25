// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IP2PEscrow} from "./interfaces/IP2PEscrow.sol";
import {ArbitratorPool} from "./ArbitratorPool.sol";

/// @title P2PEscrow
/// @notice Non-custodial escrow for P2P digital product trades with dispute resolution
contract P2PEscrow is IP2PEscrow, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint256 public constant PLATFORM_FEE_BPS = 200; // 2%
    uint256 public constant ARB_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SELLER_TIMEOUT = 24 hours;
    uint256 public constant CONFIRM_WINDOW = 72 hours;
    uint256 public constant DISPUTE_WINDOW = 7 days;
    uint256 public constant MIN_ORDER_AMOUNT = 1e6; // 1 USDT/USDC (6 decimals)

    // --- State ---
    uint256 public nextOrderId;
    address public treasury;
    ArbitratorPool public arbitratorPool;
    mapping(uint256 => Order) private _orders;
    mapping(address => bool) public supportedTokens;

    // --- Constructor ---
    constructor(address _treasury, address _arbitratorPool, address _owner) Ownable(_owner) {
        require(_treasury != address(0), "P2PEscrow: zero treasury");
        require(_arbitratorPool != address(0), "P2PEscrow: zero arbitrator pool");
        treasury = _treasury;
        arbitratorPool = ArbitratorPool(_arbitratorPool);
    }

    // ========================
    // Buyer Functions
    // ========================

    /// @inheritdoc IP2PEscrow
    function createOrder(address seller, address token, uint256 amount, bytes32 productHash)
        external
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        require(supportedTokens[token], "P2PEscrow: unsupported token");
        require(amount >= MIN_ORDER_AMOUNT, "P2PEscrow: amount too low");
        require(seller != address(0), "P2PEscrow: zero seller");
        require(seller != msg.sender, "P2PEscrow: buyer is seller");

        uint256 platformFee = (amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalDeposit = amount + platformFee;

        // Transfer tokens from buyer to escrow
        IERC20(token).safeTransferFrom(msg.sender, address(this), totalDeposit);

        uint256 orderId = nextOrderId++;

        _orders[orderId] = Order({
            id: orderId,
            buyer: msg.sender,
            seller: seller,
            arbitrator: address(0),
            token: token,
            amount: amount,
            platformFee: platformFee,
            arbitrationFee: 0,
            status: OrderStatus.Created,
            productHash: productHash,
            createdAt: block.timestamp,
            sellerConfirmedAt: 0,
            disputeDeadline: 0,
            evidenceBuyer: "",
            evidenceSeller: ""
        });

        emit OrderCreated(orderId, msg.sender, seller, token, amount, productHash);
        return orderId;
    }

    /// @inheritdoc IP2PEscrow
    function buyerConfirmReceived(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        require(msg.sender == order.buyer, "P2PEscrow: not buyer");
        require(order.status == OrderStatus.SellerConfirmed, "P2PEscrow: invalid status");

        order.status = OrderStatus.Completed;

        IERC20(order.token).safeTransfer(order.seller, order.amount);
        IERC20(order.token).safeTransfer(treasury, order.platformFee);

        emit OrderCompleted(orderId, order.amount, order.platformFee);
    }

    /// @inheritdoc IP2PEscrow
    function cancelOrder(uint256 orderId) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        require(msg.sender == order.buyer, "P2PEscrow: not buyer");
        require(order.status == OrderStatus.Created, "P2PEscrow: invalid status");

        order.status = OrderStatus.Cancelled;

        // Full refund: amount + platformFee
        uint256 refund = order.amount + order.platformFee;
        IERC20(order.token).safeTransfer(order.buyer, refund);

        emit OrderCancelled(orderId, msg.sender);
    }

    // ========================
    // Seller Functions
    // ========================

    /// @inheritdoc IP2PEscrow
    function sellerConfirmDelivery(uint256 orderId) external whenNotPaused {
        Order storage order = _orders[orderId];
        require(msg.sender == order.seller, "P2PEscrow: not seller");
        require(order.status == OrderStatus.Created, "P2PEscrow: invalid status");

        order.status = OrderStatus.SellerConfirmed;
        order.sellerConfirmedAt = block.timestamp;

        emit SellerConfirmed(orderId, block.timestamp);
    }

    // ========================
    // Shared Functions
    // ========================

    /// @inheritdoc IP2PEscrow
    function openDispute(uint256 orderId, string calldata evidenceHash) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        require(
            msg.sender == order.buyer || msg.sender == order.seller,
            "P2PEscrow: not buyer or seller"
        );
        require(
            order.status == OrderStatus.Created || order.status == OrderStatus.SellerConfirmed,
            "P2PEscrow: invalid status"
        );

        order.status = OrderStatus.Disputed;
        order.disputeDeadline = block.timestamp + DISPUTE_WINDOW;
        order.arbitrationFee = (order.amount * ARB_FEE_BPS) / BPS_DENOMINATOR;

        // Assign arbitrator
        address selectedArbitrator = arbitratorPool.selectArbitrator(order.buyer, order.seller);
        order.arbitrator = selectedArbitrator;

        // Store initial evidence
        if (msg.sender == order.buyer) {
            order.evidenceBuyer = evidenceHash;
        } else {
            order.evidenceSeller = evidenceHash;
        }

        emit DisputeOpened(orderId, msg.sender, evidenceHash);
    }

    /// @inheritdoc IP2PEscrow
    function submitEvidence(uint256 orderId, string calldata ipfsHash) external whenNotPaused {
        Order storage order = _orders[orderId];
        require(order.status == OrderStatus.Disputed, "P2PEscrow: not disputed");
        require(
            msg.sender == order.buyer || msg.sender == order.seller,
            "P2PEscrow: not buyer or seller"
        );

        if (msg.sender == order.buyer) {
            order.evidenceBuyer = ipfsHash;
        } else {
            order.evidenceSeller = ipfsHash;
        }

        emit EvidenceSubmitted(orderId, msg.sender, ipfsHash);
    }

    // ========================
    // Arbitrator Functions
    // ========================

    /// @inheritdoc IP2PEscrow
    function resolveDispute(uint256 orderId, bool favorBuyer) external nonReentrant whenNotPaused {
        Order storage order = _orders[orderId];
        require(msg.sender == order.arbitrator, "P2PEscrow: not arbitrator");
        require(order.status == OrderStatus.Disputed, "P2PEscrow: not disputed");

        IERC20 token = IERC20(order.token);
        uint256 arbFee = order.arbitrationFee;
        uint256 payout = order.amount - arbFee;

        if (favorBuyer) {
            order.status = OrderStatus.ResolvedBuyer;
            token.safeTransfer(order.buyer, payout);
        } else {
            order.status = OrderStatus.ResolvedSeller;
            token.safeTransfer(order.seller, payout);
        }

        // Arbitrator gets arbitration fee
        token.safeTransfer(order.arbitrator, arbFee);
        // Platform fee goes to treasury
        token.safeTransfer(treasury, order.platformFee);

        // Update arbitrator pool state
        arbitratorPool.decrementDisputeCount(order.arbitrator);
        arbitratorPool.recordEarnings(order.arbitrator, arbFee);
        // Default to consistent=true; owner can override via separate call if needed
        arbitratorPool.updateReputation(order.arbitrator, true);

        emit DisputeResolved(orderId, order.arbitrator, favorBuyer, arbFee);
    }

    // ========================
    // Automation Functions
    // ========================

    /// @inheritdoc IP2PEscrow
    function autoExpireOrder(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];
        require(order.status == OrderStatus.Created, "P2PEscrow: invalid status");
        require(block.timestamp > order.createdAt + SELLER_TIMEOUT, "P2PEscrow: timeout not reached");

        order.status = OrderStatus.Expired;

        // Full refund to buyer
        uint256 refund = order.amount + order.platformFee;
        IERC20(order.token).safeTransfer(order.buyer, refund);

        emit OrderExpired(orderId, 0);
    }

    /// @inheritdoc IP2PEscrow
    function autoReleaseToSeller(uint256 orderId) external nonReentrant {
        Order storage order = _orders[orderId];
        require(order.status == OrderStatus.SellerConfirmed, "P2PEscrow: invalid status");
        require(
            block.timestamp > order.sellerConfirmedAt + CONFIRM_WINDOW,
            "P2PEscrow: window not reached"
        );

        order.status = OrderStatus.Expired;

        IERC20(order.token).safeTransfer(order.seller, order.amount);
        IERC20(order.token).safeTransfer(treasury, order.platformFee);

        emit OrderExpired(orderId, 1);
    }

    // ========================
    // Admin Functions
    // ========================

    /// @notice Add or remove supported payment token
    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "P2PEscrow: zero token");
        supportedTokens[token] = supported;
    }

    /// @notice Update treasury address
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "P2PEscrow: zero treasury");
        treasury = newTreasury;
    }

    /// @notice Update arbitrator pool address
    function setArbitratorPool(address newPool) external onlyOwner {
        require(newPool != address(0), "P2PEscrow: zero pool");
        arbitratorPool = ArbitratorPool(newPool);
    }

    /// @notice Emergency pause all state-changing functions
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }

    // ========================
    // View Functions
    // ========================

    /// @inheritdoc IP2PEscrow
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return _orders[orderId];
    }
}
