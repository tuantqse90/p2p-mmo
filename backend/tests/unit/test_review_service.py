import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.base import OrderStatus
from app.models.review import Review
from app.models.user import UserProfile
from app.services.review_service import create_review
from tests.conftest import BUYER_WALLET, OTHER_WALLET, SELLER_WALLET


async def test_create_review_buyer_reviews_seller(db_session, completed_order):
    review = await create_review(
        completed_order.id, BUYER_WALLET, 5, db_session
    )
    assert review.id is not None
    assert review.order_id == completed_order.id
    assert review.reviewer_wallet == BUYER_WALLET
    assert review.target_wallet == SELLER_WALLET
    assert review.rating == 5


async def test_create_review_seller_reviews_buyer(db_session, completed_order):
    review = await create_review(
        completed_order.id, SELLER_WALLET, 4, db_session
    )
    assert review.reviewer_wallet == SELLER_WALLET
    assert review.target_wallet == BUYER_WALLET
    assert review.rating == 4


async def test_create_review_updates_target_rating(db_session, completed_order):
    await create_review(completed_order.id, BUYER_WALLET, 4, db_session)

    result = await db_session.execute(
        select(UserProfile).where(UserProfile.wallet == SELLER_WALLET)
    )
    seller = result.scalar_one()
    assert seller.rating == Decimal("4.00")


async def test_create_review_order_not_found(db_session):
    with pytest.raises(ValueError, match="NOT_FOUND"):
        await create_review(uuid.uuid4(), BUYER_WALLET, 5, db_session)


async def test_create_review_order_not_completed(db_session, sample_order):
    with pytest.raises(ValueError, match="FORBIDDEN"):
        await create_review(sample_order.id, BUYER_WALLET, 5, db_session)


async def test_create_review_not_party(db_session, completed_order):
    with pytest.raises(ValueError, match="FORBIDDEN"):
        await create_review(completed_order.id, OTHER_WALLET, 5, db_session)


async def test_create_review_resolved_buyer_order(db_session, disputed_order):
    disputed_order.status = OrderStatus.RESOLVED_BUYER
    await db_session.flush()

    review = await create_review(
        disputed_order.id, BUYER_WALLET, 3, db_session
    )
    assert review.rating == 3


async def test_create_review_resolved_seller_order(db_session, disputed_order):
    disputed_order.status = OrderStatus.RESOLVED_SELLER
    await db_session.flush()

    review = await create_review(
        disputed_order.id, SELLER_WALLET, 5, db_session
    )
    assert review.rating == 5
