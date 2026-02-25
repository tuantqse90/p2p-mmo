from datetime import datetime

from pydantic import BaseModel, Field


class NonceRequest(BaseModel):
    wallet_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")


class NonceResponse(BaseModel):
    nonce: str
    message: str


class VerifyRequest(BaseModel):
    wallet_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
    signature: str
    public_key: str = Field(..., min_length=40, max_length=88)


class TokenResponse(BaseModel):
    token: str
    expires_at: datetime
    wallet_address: str
