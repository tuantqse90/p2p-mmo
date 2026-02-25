import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, SmallInteger, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False
    )
    reviewer_wallet: Mapped[str] = mapped_column(
        String(42), ForeignKey("user_profiles.wallet"), nullable=False
    )
    target_wallet: Mapped[str] = mapped_column(
        String(42), ForeignKey("user_profiles.wallet"), nullable=False
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("order_id", "reviewer_wallet", name="uq_reviews_order_reviewer"),
        Index("ix_reviews_target", "target_wallet"),
        Index("ix_reviews_order", "order_id"),
    )
