import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import UserProfile
from app.schemas.message import MessageCreate, MessageResponse
from app.services import message_service

router = APIRouter()


@router.get("/orders/{order_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    order_id: uuid.UUID,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        messages = await message_service.get_messages(order_id, user.wallet, db)
    except ValueError as e:
        code = str(e)
        if code == "NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=code)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=code)
    return [MessageResponse.model_validate(m) for m in messages]


@router.post(
    "/orders/{order_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    order_id: uuid.UUID,
    body: MessageCreate,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        message = await message_service.create_message(
            order_id, user.wallet, body.ciphertext, body.nonce, db
        )
    except ValueError as e:
        code = str(e)
        if code == "NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=code)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=code)
    return MessageResponse.model_validate(message)
