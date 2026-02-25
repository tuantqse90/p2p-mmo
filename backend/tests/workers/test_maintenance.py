from app.models.base import UserTier
from app.models.user import UserProfile
from app.workers.maintenance import _recalculate_tiers, cleanup_expired_nonces
from tests.conftest import BUYER_WALLET, DEFAULT_PUBLIC_KEY, SELLER_WALLET, test_engine

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


async def test_recalculate_tiers(db_session, buyer_user, seller_user):
    """Test that tiers are recalculated based on total_trades."""
    buyer_user.total_trades = 10
    seller_user.total_trades = 55
    await db_session.commit()

    import app.workers.maintenance as maint
    from app.core import database as db_module

    original_factory = db_module.async_session_factory
    test_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    db_module.async_session_factory = test_factory
    maint.async_session_factory = test_factory

    try:
        await _recalculate_tiers()
    finally:
        db_module.async_session_factory = original_factory
        maint.async_session_factory = original_factory

    async with test_factory() as session:
        result = await session.execute(
            select(UserProfile).where(UserProfile.wallet == BUYER_WALLET)
        )
        buyer = result.scalar_one()
        assert buyer.tier == UserTier.STANDARD

        result = await session.execute(
            select(UserProfile).where(UserProfile.wallet == SELLER_WALLET)
        )
        seller = result.scalar_one()
        assert seller.tier == UserTier.TRUSTED


async def test_recalculate_tiers_new(db_session, buyer_user):
    """Users with < 5 trades should remain NEW tier."""
    buyer_user.total_trades = 3
    buyer_user.tier = UserTier.STANDARD  # wrongly set
    await db_session.commit()

    import app.workers.maintenance as maint
    from app.core import database as db_module

    original_factory = db_module.async_session_factory
    test_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    db_module.async_session_factory = test_factory
    maint.async_session_factory = test_factory

    try:
        await _recalculate_tiers()
    finally:
        db_module.async_session_factory = original_factory
        maint.async_session_factory = original_factory

    async with test_factory() as session:
        result = await session.execute(
            select(UserProfile).where(UserProfile.wallet == BUYER_WALLET)
        )
        buyer = result.scalar_one()
        assert buyer.tier == UserTier.NEW


def test_cleanup_expired_nonces():
    """Cleanup task should run without error (Redis handles TTL)."""
    cleanup_expired_nonces()
