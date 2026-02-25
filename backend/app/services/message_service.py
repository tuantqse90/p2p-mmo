import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.order import Order


async def get_messages(
    order_id: uuid.UUID,
    wallet: str,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[Message], int]:
    # Verify user is party to the order
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise ValueError("NOT_FOUND")
    if wallet not in (order.buyer_wallet, order.seller_wallet, order.arbitrator_wallet):
        raise ValueError("FORBIDDEN")

    base_query = select(Message).where(Message.order_id == order_id)

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate (newest first in pages, but messages in ascending order within page)
    offset = (page - 1) * page_size
    result = await db.execute(
        base_query.order_by(Message.created_at.asc())
        .offset(offset)
        .limit(page_size)
    )
    return list(result.scalars().all()), total


async def create_message(
    order_id: uuid.UUID,
    sender_wallet: str,
    ciphertext: str,
    nonce: str,
    db: AsyncSession,
) -> Message:
    # Verify sender is party to the order
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise ValueError("NOT_FOUND")
    if sender_wallet not in (order.buyer_wallet, order.seller_wallet, order.arbitrator_wallet):
        raise ValueError("FORBIDDEN")

    message = Message(
        order_id=order_id,
        sender_wallet=sender_wallet,
        ciphertext=ciphertext,
        nonce=nonce,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message
