from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.models.base import ChainType, OrderStatus, TokenType
from app.models.order import Order
from app.workers.timeout_checker import CONFIRM_WINDOW, SELLER_TIMEOUT, _check_timeouts
from tests.conftest import BUYER_WALLET, DEFAULT_TX_HASH, SELLER_WALLET, test_engine

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import select

from app.models.base import Base


async def test_seller_timeout_expires_order(db_session, buyer_user, sample_product):
    """Orders in CREATED status older than 24h should expire."""
    # Create an old order (simulate created_at in the past)
    order = Order(
        buyer_wallet=BUYER_WALLET,
        seller_wallet=SELLER_WALLET,
        product_id=sample_product.id,
        chain=ChainType.BSC,
        token=TokenType.USDT,
        amount=Decimal("100"),
        platform_fee=Decimal("2"),
        status=OrderStatus.CREATED,
        tx_hash_create=DEFAULT_TX_HASH,
    )
    db_session.add(order)
    await db_session.flush()

    # Manually set created_at to 25 hours ago
    from sqlalchemy import update

    await db_session.execute(
        update(Order)
        .where(Order.id == order.id)
        .values(created_at=datetime.now(UTC) - timedelta(hours=25))
    )
    await db_session.commit()

    # Run timeout checker using the test session
    # We need to patch async_session_factory to use our test session
    import app.workers.timeout_checker as tc
    from app.core import database as db_module

    original_factory = db_module.async_session_factory
    test_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    db_module.async_session_factory = test_factory
    tc.async_session_factory = test_factory

    try:
        await _check_timeouts()
    finally:
        db_module.async_session_factory = original_factory
        tc.async_session_factory = original_factory

    # Check order status
    async with test_factory() as session:
        result = await session.execute(select(Order).where(Order.id == order.id))
        updated_order = result.scalar_one()
        assert updated_order.status == OrderStatus.EXPIRED


async def test_buyer_timeout_auto_releases(db_session, buyer_user, sample_product):
    """SellerConfirmed orders with seller_confirmed_at > 72h should auto-complete."""
    order = Order(
        buyer_wallet=BUYER_WALLET,
        seller_wallet=SELLER_WALLET,
        product_id=sample_product.id,
        chain=ChainType.BSC,
        token=TokenType.USDT,
        amount=Decimal("100"),
        platform_fee=Decimal("2"),
        status=OrderStatus.SELLER_CONFIRMED,
        tx_hash_create="0x" + "a" * 64,
        seller_confirmed_at=datetime.now(UTC) - timedelta(hours=73),
    )
    db_session.add(order)
    await db_session.commit()

    import app.workers.timeout_checker as tc
    from app.core import database as db_module

    original_factory = db_module.async_session_factory
    test_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    db_module.async_session_factory = test_factory
    tc.async_session_factory = test_factory

    try:
        await _check_timeouts()
    finally:
        db_module.async_session_factory = original_factory
        tc.async_session_factory = original_factory

    async with test_factory() as session:
        result = await session.execute(select(Order).where(Order.id == order.id))
        updated_order = result.scalar_one()
        assert updated_order.status == OrderStatus.COMPLETED
        assert updated_order.completed_at is not None


async def test_no_timeout_for_recent_orders(db_session, sample_order):
    """Recent orders should not be affected by timeout checker."""
    import app.workers.timeout_checker as tc
    from app.core import database as db_module

    original_factory = db_module.async_session_factory
    test_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    db_module.async_session_factory = test_factory
    tc.async_session_factory = test_factory

    await db_session.commit()

    try:
        await _check_timeouts()
    finally:
        db_module.async_session_factory = original_factory
        tc.async_session_factory = original_factory

    await db_session.refresh(sample_order)
    assert sample_order.status == OrderStatus.CREATED
