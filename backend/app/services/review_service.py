import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import OrderStatus
from app.models.order import Order
from app.models.review import Review
from app.models.user import UserProfile


async def create_review(
    order_id: uuid.UUID,
    reviewer_wallet: str,
    rating: int,
    db: AsyncSession,
) -> Review:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise ValueError("NOT_FOUND")

    # Only completed or resolved orders can be reviewed
    if order.status not in (
        OrderStatus.COMPLETED,
        OrderStatus.RESOLVED_BUYER,
        OrderStatus.RESOLVED_SELLER,
    ):
        raise ValueError("FORBIDDEN")

    if reviewer_wallet not in (order.buyer_wallet, order.seller_wallet):
        raise ValueError("FORBIDDEN")

    # Determine target (the other party)
    target_wallet = (
        order.seller_wallet if reviewer_wallet == order.buyer_wallet else order.buyer_wallet
    )

    review = Review(
        order_id=order_id,
        reviewer_wallet=reviewer_wallet,
        target_wallet=target_wallet,
        rating=rating,
    )
    db.add(review)
    await db.flush()

    # Recalculate target's average rating
    avg_result = await db.execute(
        select(func.avg(Review.rating)).where(Review.target_wallet == target_wallet)
    )
    avg_rating = avg_result.scalar_one()

    target = await db.execute(select(UserProfile).where(UserProfile.wallet == target_wallet))
    target_user = target.scalar_one_or_none()
    if target_user and avg_rating is not None:
        target_user.rating = round(avg_rating, 2)
        await db.flush()

    await db.refresh(review)
    return review
