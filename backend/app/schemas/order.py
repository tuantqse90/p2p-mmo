import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.base import ChainType, OrderStatus, TokenType


class OrderCreate(BaseModel):
    product_id: uuid.UUID
    token: TokenType
    amount: Decimal = Field(..., gt=0)
    tx_hash: str = Field(..., pattern=r"^0x[a-fA-F0-9]{64}$")
    chain: ChainType = ChainType.BSC


class OrderResponse(BaseModel):
    id: uuid.UUID
    onchain_order_id: int | None
    chain: ChainType
    buyer_wallet: str
    seller_wallet: str
    arbitrator_wallet: str | None
    product_id: uuid.UUID
    token: TokenType
    amount: Decimal
    platform_fee: Decimal
    status: OrderStatus
    product_key_encrypted: str | None
    tx_hash_create: str
    tx_hash_complete: str | None
    seller_confirmed_at: datetime | None
    dispute_opened_at: datetime | None
    dispute_deadline: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrderListParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    status: OrderStatus | None = None
    role: str | None = Field(None, pattern=r"^(buyer|seller)$")


class DeliverRequest(BaseModel):
    product_key_encrypted: str = Field(..., min_length=1)


class ConfirmRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)


class DisputeRequest(BaseModel):
    evidence_hash: str = Field(..., min_length=1)
    evidence_type: str = Field("other", pattern=r"^(screenshot|conversation|product_proof|other)$")
