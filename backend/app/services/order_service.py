import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import OrderStatus
from app.models.order import Order
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderListParams


PLATFORM_FEE_BPS = 200
BPS_DENOMINATOR = 10_000


async def create_order(buyer_wallet: str, data: OrderCreate, db: AsyncSession) -> Order:
    # Fetch product
    result = await db.execute(select(Product).where(Product.id == data.product_id))
    product = result.scalar_one_or_none()
    if product is None:
        raise ValueError("NOT_FOUND")

    if product.seller_wallet == buyer_wallet:
        raise ValueError("FORBIDDEN")

    platform_fee = (data.amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR

    order = Order(
        buyer_wallet=buyer_wallet,
        seller_wallet=product.seller_wallet,
        product_id=data.product_id,
        chain=data.chain,
        token=data.token,
        amount=data.amount,
        platform_fee=platform_fee,
        tx_hash_create=data.tx_hash,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return order


async def get_order(order_id: uuid.UUID, db: AsyncSession) -> Order | None:
    result = await db.execute(select(Order).where(Order.id == order_id))
    return result.scalar_one_or_none()


async def list_orders(
    wallet: str, params: OrderListParams, db: AsyncSession
) -> tuple[list[Order], int]:
    query = select(Order)

    if params.role == "buyer":
        query = query.where(Order.buyer_wallet == wallet)
    elif params.role == "seller":
        query = query.where(Order.seller_wallet == wallet)
    else:
        query = query.where((Order.buyer_wallet == wallet) | (Order.seller_wallet == wallet))

    if params.status:
        query = query.where(Order.status == params.status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Order.created_at.desc())
    offset = (params.page - 1) * params.page_size
    query = query.offset(offset).limit(params.page_size)

    result = await db.execute(query)
    return list(result.scalars().all()), total


async def seller_confirm_delivery(
    order: Order, product_key_encrypted: str, db: AsyncSession
) -> Order:
    if order.status != OrderStatus.CREATED:
        raise ValueError("ORDER_NOT_CANCELLABLE")
    order.status = OrderStatus.SELLER_CONFIRMED
    order.seller_confirmed_at = datetime.now(UTC)
    order.product_key_encrypted = product_key_encrypted
    await db.flush()
    await db.refresh(order)
    return order


async def buyer_confirm_received(order: Order, db: AsyncSession) -> Order:
    if order.status != OrderStatus.SELLER_CONFIRMED:
        raise ValueError("ORDER_NOT_CANCELLABLE")
    order.status = OrderStatus.COMPLETED
    order.completed_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(order)
    return order


async def cancel_order(order: Order, db: AsyncSession) -> Order:
    if order.status != OrderStatus.CREATED:
        raise ValueError("ORDER_NOT_CANCELLABLE")
    order.status = OrderStatus.CANCELLED
    await db.flush()
    await db.refresh(order)
    return order


async def open_dispute(order: Order, db: AsyncSession) -> Order:
    if order.status not in (OrderStatus.CREATED, OrderStatus.SELLER_CONFIRMED):
        raise ValueError("ORDER_NOT_CANCELLABLE")
    order.status = OrderStatus.DISPUTED
    order.dispute_opened_at = datetime.now(UTC)
    await db.flush()
    await db.refresh(order)
    return order
