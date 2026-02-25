import asyncio
import logging

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_factory
from app.models.base import UserTier
from app.models.user import UserProfile
from app.workers import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.maintenance.cleanup_expired_nonces")
def cleanup_expired_nonces():
    # Redis handles TTL expiry automatically, but we log for monitoring
    logger.debug("Nonce cleanup: Redis handles TTL expiry automatically")


@celery_app.task(name="app.workers.maintenance.recalculate_tiers")
def recalculate_tiers():
    asyncio.get_event_loop().run_until_complete(_recalculate_tiers())


async def _recalculate_tiers():
    async with async_session_factory() as db:
        result = await db.execute(select(UserProfile))
        users = result.scalars().all()

        updated = 0
        for user in users:
            old_tier = user.tier
            if user.total_trades >= 50:
                user.tier = UserTier.TRUSTED
            elif user.total_trades >= 5:
                user.tier = UserTier.STANDARD
            else:
                user.tier = UserTier.NEW

            if user.tier != old_tier:
                updated += 1

        await db.commit()
        logger.info(f"Tier recalculation: {updated} users updated out of {len(users)}")
