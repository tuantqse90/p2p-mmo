import enum
from datetime import UTC, datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# --- Enums ---

class UserTier(str, enum.Enum):
    NEW = "new"
    STANDARD = "standard"
    TRUSTED = "trusted"


class ProductCategory(str, enum.Enum):
    DATA = "data"
    ACCOUNTS = "accounts"
    TOOLS = "tools"
    SERVICES = "services"
    OTHER = "other"


class ProductStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    SOLD_OUT = "sold_out"
    DELETED = "deleted"


class ChainType(str, enum.Enum):
    BSC = "bsc"
    ETHEREUM = "ethereum"
    ARBITRUM = "arbitrum"
    BASE = "base"


class TokenType(str, enum.Enum):
    USDT = "USDT"
    USDC = "USDC"


class OrderStatus(str, enum.Enum):
    CREATED = "created"
    SELLER_CONFIRMED = "seller_confirmed"
    COMPLETED = "completed"
    DISPUTED = "disputed"
    RESOLVED_BUYER = "resolved_buyer"
    RESOLVED_SELLER = "resolved_seller"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class EvidenceType(str, enum.Enum):
    SCREENSHOT = "screenshot"
    CONVERSATION = "conversation"
    PRODUCT_PROOF = "product_proof"
    OTHER = "other"
