import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    ciphertext: str = Field(..., min_length=1)
    nonce: str = Field(..., min_length=1, max_length=44)


class MessageResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    sender_wallet: str
    ciphertext: str
    nonce: str
    created_at: datetime

    model_config = {"from_attributes": True}
