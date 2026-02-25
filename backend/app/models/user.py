from decimal import Decimal

from sqlalchemy import Boolean, Enum, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UserTier


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    wallet: Mapped[str] = mapped_column(String(42), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(50))
    public_key: Mapped[str] = mapped_column(String(88), nullable=False)
    reputation_score: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    total_trades: Mapped[int] = mapped_column(Integer, default=0)
    total_as_buyer: Mapped[int] = mapped_column(Integer, default=0)
    total_as_seller: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    tier: Mapped[UserTier] = mapped_column(Enum(UserTier, name="user_tier"), default=UserTier.NEW)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        Index("ix_user_profiles_tier", "tier"),
        Index("ix_user_profiles_rating", "rating"),
    )
