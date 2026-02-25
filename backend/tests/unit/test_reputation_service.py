from sqlalchemy import select

from app.models.base import UserTier
from app.models.user import UserProfile
from app.services.reputation_service import update_trade_counts
from tests.conftest import BUYER_WALLET, OTHER_WALLET, SELLER_WALLET


async def test_update_trade_counts(db_session, buyer_user, seller_user):
    await update_trade_counts(BUYER_WALLET, SELLER_WALLET, db_session)

    await db_session.refresh(buyer_user)
    await db_session.refresh(seller_user)

    assert buyer_user.total_trades == 1
    assert buyer_user.total_as_buyer == 1
    assert buyer_user.total_as_seller == 0

    assert seller_user.total_trades == 1
    assert seller_user.total_as_seller == 1
    assert seller_user.total_as_buyer == 0


async def test_update_trade_counts_tier_standard(db_session, buyer_user, seller_user):
    buyer_user.total_trades = 4
    buyer_user.total_as_buyer = 4
    await db_session.flush()

    await update_trade_counts(BUYER_WALLET, SELLER_WALLET, db_session)

    await db_session.refresh(buyer_user)
    assert buyer_user.total_trades == 5
    assert buyer_user.tier == UserTier.STANDARD


async def test_update_trade_counts_tier_trusted(db_session, buyer_user, seller_user):
    buyer_user.total_trades = 49
    buyer_user.total_as_buyer = 49
    await db_session.flush()

    await update_trade_counts(BUYER_WALLET, SELLER_WALLET, db_session)

    await db_session.refresh(buyer_user)
    assert buyer_user.total_trades == 50
    assert buyer_user.tier == UserTier.TRUSTED


async def test_update_trade_counts_missing_user(db_session, buyer_user):
    # seller doesn't exist - should skip without error
    await update_trade_counts(BUYER_WALLET, OTHER_WALLET, db_session)

    await db_session.refresh(buyer_user)
    assert buyer_user.total_trades == 1
