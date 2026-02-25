from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Blacklist(Base):
    __tablename__ = "blacklist"

    wallet: Mapped[str] = mapped_column(String(42), primary_key=True)
    reason: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    added_by: Mapped[str] = mapped_column(String(42), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
