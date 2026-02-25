from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, ChainType


class EventSyncCursor(Base):
    __tablename__ = "event_sync_cursor"

    chain: Mapped[ChainType] = mapped_column(
        Enum(ChainType, name="chain_type", create_type=False), primary_key=True
    )
    contract: Mapped[str] = mapped_column(String(42), nullable=False)
    last_block: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
