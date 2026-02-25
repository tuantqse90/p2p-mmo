import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.base import EvidenceType


class EvidenceSubmit(BaseModel):
    ipfs_hash: str = Field(..., min_length=1, max_length=100)
    evidence_type: EvidenceType


class EvidenceResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    submitter_wallet: str
    ipfs_hash: str
    evidence_type: EvidenceType
    created_at: datetime

    model_config = {"from_attributes": True}


class ResolveRequest(BaseModel):
    favor_buyer: bool
