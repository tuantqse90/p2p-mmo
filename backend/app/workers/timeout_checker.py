import asyncio
import logging
from datetime import UTC, datetime, timedelta

from redis import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_factory
from app.models.base import OrderStatus
from app.models.order import Order
from app.workers import celery_app

logger = logging.getLogger(__name__)

SELLER_TIMEOUT = timedelta(hours=24)
CONFIRM_WINDOW = timedelta(hours=72)
LOCK_KEY = "lock:timeout_checker"
LOCK_TTL = 120  # seconds


@celery_app.task(name="app.workers.timeout_checker.check_timeouts")
def check_timeouts():
    redis = Redis.from_url(settings.redis_url)
    acquired = redis.set(LOCK_KEY, "1", nx=True, ex=LOCK_TTL)
    if not acquired:
        logger.info("Timeout checker already running on another worker, skipping")
        return
    try:
        asyncio.get_event_loop().run_until_complete(_check_timeouts())
    finally:
        redis.delete(LOCK_KEY)


async def _check_timeouts():
    now = datetime.now(UTC)

    async with async_session_factory() as db:
        # Seller timeout: Created orders older than 24h
        cutoff_seller = now - SELLER_TIMEOUT
        result = await db.execute(
            select(Order).where(
                Order.status == OrderStatus.CREATED,
                Order.created_at < cutoff_seller,
            )
        )
        expired_orders = result.scalars().all()
        for order in expired_orders:
            order.status = OrderStatus.EXPIRED
            logger.info(f"Order {order.id} expired (seller timeout)")

        # Buyer timeout: SellerConfirmed orders older than 72h
        cutoff_buyer = now - CONFIRM_WINDOW
        result = await db.execute(
            select(Order).where(
                Order.status == OrderStatus.SELLER_CONFIRMED,
                Order.seller_confirmed_at < cutoff_buyer,
            )
        )
        auto_release_orders = result.scalars().all()
        for order in auto_release_orders:
            order.status = OrderStatus.COMPLETED
            order.completed_at = now
            logger.info(f"Order {order.id} auto-released to seller (buyer timeout)")

        await db.commit()

        if expired_orders or auto_release_orders:
            logger.info(
                f"Timeouts processed: {len(expired_orders)} expired, "
                f"{len(auto_release_orders)} auto-released"
            )
