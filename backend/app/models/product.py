import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ProductCategory, ProductStatus, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_wallet: Mapped[str] = mapped_column(
        String(42), ForeignKey("user_profiles.wallet"), nullable=False
    )
    title_preview: Mapped[str] = mapped_column(String(100), nullable=False)
    description_preview: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[ProductCategory] = mapped_column(
        Enum(ProductCategory, name="product_category"), nullable=False
    )
    price_usdt: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    total_sold: Mapped[int] = mapped_column(Integer, default=0)
    product_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    status: Mapped[ProductStatus] = mapped_column(
        Enum(ProductStatus, name="product_status"), default=ProductStatus.ACTIVE
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_products_seller", "seller_wallet"),
        Index("ix_products_category", "category"),
        Index("ix_products_status", "status"),
        Index("ix_products_price", "price_usdt"),
        Index("ix_products_created_at", "created_at"),
    )
