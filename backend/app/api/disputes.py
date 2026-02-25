import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import UserProfile
from app.schemas.dispute import EvidenceResponse, EvidenceSubmit, ResolveRequest
from app.schemas.order import OrderResponse
from app.services import dispute_service

router = APIRouter()


@router.post("/{order_id}/evidence", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def submit_evidence(
    order_id: uuid.UUID,
    body: EvidenceSubmit,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        evidence = await dispute_service.submit_evidence(
            order_id, user.wallet, body.ipfs_hash, body.evidence_type, db
        )
    except ValueError as e:
        code = str(e)
        if code == "NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=code)
        if code == "FORBIDDEN":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=code)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code)
    return EvidenceResponse.model_validate(evidence)


@router.post("/{order_id}/resolve", response_model=OrderResponse)
async def resolve_dispute(
    order_id: uuid.UUID,
    body: ResolveRequest,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order = await dispute_service.resolve_dispute(
            order_id, user.wallet, body.favor_buyer, db
        )
    except ValueError as e:
        code = str(e)
        if code == "NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=code)
        if code == "NOT_ARBITRATOR":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=code)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code)
    return OrderResponse.model_validate(order)
