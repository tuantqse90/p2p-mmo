"""Helper factory functions for creating test data."""

import uuid
from decimal import Decimal

from app.models.base import (
    ChainType,
    EvidenceType,
    OrderStatus,
    ProductCategory,
    ProductStatus,
    TokenType,
    UserTier,
)
from app.models.dispute import DisputeEvidence
from app.models.message import Message
from app.models.order import Order
from app.models.product import Product
from app.models.review import Review
from app.models.user import UserProfile

BUYER_WALLET = "0x" + "a" * 40
SELLER_WALLET = "0x" + "b" * 40
ARBITRATOR_WALLET = "0x" + "c" * 40
DEFAULT_TX_HASH = "0x" + "f" * 64
DEFAULT_PRODUCT_HASH = "0x" + "e" * 64
DEFAULT_PUBLIC_KEY = "A" * 88


def make_user(wallet: str = BUYER_WALLET, **kwargs) -> UserProfile:
    defaults = {
        "wallet": wallet,
        "public_key": DEFAULT_PUBLIC_KEY,
        "reputation_score": Decimal("0"),
        "total_trades": 0,
        "total_as_buyer": 0,
        "total_as_seller": 0,
        "tier": UserTier.NEW,
        "is_blacklisted": False,
    }
    defaults.update(kwargs)
    return UserProfile(**defaults)


def make_product(seller_wallet: str = SELLER_WALLET, **kwargs) -> Product:
    defaults = {
        "seller_wallet": seller_wallet,
        "title_preview": "Test Product",
        "description_preview": "A test product for testing",
        "category": ProductCategory.DATA,
        "price_usdt": Decimal("100.000000"),
        "stock": 10,
        "total_sold": 0,
        "product_hash": DEFAULT_PRODUCT_HASH,
        "status": ProductStatus.ACTIVE,
    }
    defaults.update(kwargs)
    return Product(**defaults)


def make_order(
    buyer_wallet: str = BUYER_WALLET,
    seller_wallet: str = SELLER_WALLET,
    product_id: uuid.UUID | None = None,
    **kwargs,
) -> Order:
    defaults = {
        "buyer_wallet": buyer_wallet,
        "seller_wallet": seller_wallet,
        "product_id": product_id or uuid.uuid4(),
        "chain": ChainType.BSC,
        "token": TokenType.USDT,
        "amount": Decimal("100.000000"),
        "platform_fee": Decimal("2.000000"),
        "status": OrderStatus.CREATED,
        "tx_hash_create": DEFAULT_TX_HASH,
    }
    defaults.update(kwargs)
    return Order(**defaults)


def make_message(
    order_id: uuid.UUID,
    sender_wallet: str = BUYER_WALLET,
    **kwargs,
) -> Message:
    defaults = {
        "order_id": order_id,
        "sender_wallet": sender_wallet,
        "ciphertext": "encrypted_message_content_base64",
        "nonce": "nonce_base64_value_here_padded_to_length",
    }
    defaults.update(kwargs)
    return Message(**defaults)


def make_review(
    order_id: uuid.UUID,
    reviewer_wallet: str = BUYER_WALLET,
    target_wallet: str = SELLER_WALLET,
    rating: int = 5,
    **kwargs,
) -> Review:
    defaults = {
        "order_id": order_id,
        "reviewer_wallet": reviewer_wallet,
        "target_wallet": target_wallet,
        "rating": rating,
    }
    defaults.update(kwargs)
    return Review(**defaults)


def make_evidence(
    order_id: uuid.UUID,
    submitter_wallet: str = BUYER_WALLET,
    **kwargs,
) -> DisputeEvidence:
    defaults = {
        "order_id": order_id,
        "submitter_wallet": submitter_wallet,
        "ipfs_hash": "QmTestHash123456789",
        "evidence_type": EvidenceType.SCREENSHOT,
    }
    defaults.update(kwargs)
    return DisputeEvidence(**defaults)
