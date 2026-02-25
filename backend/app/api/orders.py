import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.base import OrderStatus
from app.models.user import UserProfile
from app.schemas.common import PaginatedResponse
from app.schemas.order import (
    ConfirmRequest,
    DeliverRequest,
    DisputeRequest,
    OrderCreate,
    OrderListParams,
    OrderResponse,
)
from app.services import order_service, reputation_service, review_service

router = APIRouter()


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        order = await order_service.create_order(user.wallet, body, db)
    except ValueError as e:
        code = str(e)
        if code == "NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=code)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code)
    return OrderResponse.model_validate(order)


@router.get("", response_model=PaginatedResponse[OrderResponse])
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: OrderStatus | None = Query(None, alias="status"),
    role: str | None = Query(None, pattern=r"^(buyer|seller)$"),
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    params = OrderListParams(page=page, page_size=page_size, status=status_filter, role=role)
    orders, total = await order_service.list_orders(user.wallet, params, db)
    return PaginatedResponse(
        items=[OrderResponse.model_validate(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: uuid.UUID,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await order_service.get_order(order_id, db)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    if user.wallet not in (order.buyer_wallet, order.seller_wallet, order.arbitrator_wallet):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/deliver", response_model=OrderResponse)
async def deliver_order(
    order_id: uuid.UUID,
    body: DeliverRequest,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await order_service.get_order(order_id, db)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    if order.seller_wallet != user.wallet:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="NOT_SELLER")

    try:
        order = await order_service.seller_confirm_delivery(order, body.product_key_encrypted, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_order(
    order_id: uuid.UUID,
    body: ConfirmRequest,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await order_service.get_order(order_id, db)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    if order.buyer_wallet != user.wallet:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="NOT_BUYER")

    try:
        order = await order_service.buyer_confirm_received(order, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Create review and update trade counts
    await review_service.create_review(order_id, user.wallet, body.rating, db)
    await reputation_service.update_trade_counts(order.buyer_wallet, order.seller_wallet, db)

    return OrderResponse.model_validate(order)


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: uuid.UUID,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await order_service.get_order(order_id, db)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    if order.buyer_wallet != user.wallet:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="NOT_BUYER")

    try:
        order = await order_service.cancel_order(order, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/dispute", response_model=OrderResponse)
async def open_dispute(
    order_id: uuid.UUID,
    body: DisputeRequest,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await order_service.get_order(order_id, db)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    if user.wallet not in (order.buyer_wallet, order.seller_wallet):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FORBIDDEN")

    try:
        order = await order_service.open_dispute(order, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return OrderResponse.model_validate(order)
