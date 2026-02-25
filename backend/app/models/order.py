import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, ChainType, OrderStatus, TimestampMixin, TokenType


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    onchain_order_id: Mapped[int | None] = mapped_column(BigInteger)
    chain: Mapped[ChainType] = mapped_column(
        Enum(ChainType, name="chain_type"), default=ChainType.BSC
    )
    buyer_wallet: Mapped[str] = mapped_column(
        String(42), ForeignKey("user_profiles.wallet"), nullable=False
    )
    seller_wallet: Mapped[str] = mapped_column(
        String(42), ForeignKey("user_profiles.wallet"), nullable=False
    )
    arbitrator_wallet: Mapped[str | None] = mapped_column(
        String(42), ForeignKey("user_profiles.wallet")
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    token: Mapped[TokenType] = mapped_column(Enum(TokenType, name="token_type"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"), default=OrderStatus.CREATED
    )
    product_key_encrypted: Mapped[str | None] = mapped_column(Text)
    tx_hash_create: Mapped[str] = mapped_column(String(66), nullable=False)
    tx_hash_complete: Mapped[str | None] = mapped_column(String(66))
    seller_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispute_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispute_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    messages = relationship("Message", back_populates="order", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("chain", "onchain_order_id", name="uq_orders_chain_onchain"),
        Index("ix_orders_buyer", "buyer_wallet"),
        Index("ix_orders_seller", "seller_wallet"),
        Index("ix_orders_arbitrator", "arbitrator_wallet"),
        Index("ix_orders_product", "product_id"),
        Index("ix_orders_status", "status"),
        Index("ix_orders_chain_status", "chain", "status"),
    )
