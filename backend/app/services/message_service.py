import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.order import Order


async def get_messages(order_id: uuid.UUID, wallet: str, db: AsyncSession) -> list[Message]:
    # Verify user is party to the order
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise ValueError("NOT_FOUND")
    if wallet not in (order.buyer_wallet, order.seller_wallet, order.arbitrator_wallet):
        raise ValueError("FORBIDDEN")

    result = await db.execute(
        select(Message)
        .where(Message.order_id == order_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


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
