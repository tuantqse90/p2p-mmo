from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Arbitrator(Base):
    __tablename__ = "arbitrators"

    wallet: Mapped[str] = mapped_column(
        String(42), ForeignKey("user_profiles.wallet"), primary_key=True
    )
    stake_amount: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    stake_token: Mapped[str] = mapped_column(String(42), nullable=False)
    reputation: Mapped[int] = mapped_column(SmallInteger, default=50)
    total_resolved: Mapped[int] = mapped_column(Integer, default=0)
    total_earned: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
