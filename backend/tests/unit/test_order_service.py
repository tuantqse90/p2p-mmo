import uuid
from decimal import Decimal

import pytest

from app.models.base import ChainType, OrderStatus, TokenType
from app.models.order import Order
from app.schemas.order import OrderCreate, OrderListParams
from app.services.order_service import (
    PLATFORM_FEE_BPS,
    BPS_DENOMINATOR,
    buyer_confirm_received,
    cancel_order,
    create_order,
    get_order,
    list_orders,
    open_dispute,
    seller_confirm_delivery,
)
from tests.conftest import BUYER_WALLET, DEFAULT_TX_HASH, SELLER_WALLET


async def test_create_order(db_session, buyer_user, sample_product):
    data = OrderCreate(
        product_id=sample_product.id,
        token=TokenType.USDT,
        amount=Decimal("100"),
        tx_hash=DEFAULT_TX_HASH,
    )
    order = await create_order(buyer_user.wallet, data, db_session)

    assert order.id is not None
    assert order.buyer_wallet == buyer_user.wallet
    assert order.seller_wallet == sample_product.seller_wallet
    assert order.product_id == sample_product.id
    assert order.status == OrderStatus.CREATED
    expected_fee = (Decimal("100") * PLATFORM_FEE_BPS) / BPS_DENOMINATOR
    assert order.platform_fee == expected_fee


async def test_create_order_product_not_found(db_session, buyer_user):
    data = OrderCreate(
        product_id=uuid.uuid4(),
        token=TokenType.USDT,
        amount=Decimal("100"),
        tx_hash=DEFAULT_TX_HASH,
    )
    with pytest.raises(ValueError, match="NOT_FOUND"):
        await create_order(buyer_user.wallet, data, db_session)


async def test_create_order_seller_cannot_buy_own(db_session, seller_user, sample_product):
    data = OrderCreate(
        product_id=sample_product.id,
        token=TokenType.USDT,
        amount=Decimal("100"),
        tx_hash=DEFAULT_TX_HASH,
    )
    with pytest.raises(ValueError, match="FORBIDDEN"):
        await create_order(seller_user.wallet, data, db_session)


async def test_get_order(db_session, sample_order):
    result = await get_order(sample_order.id, db_session)
    assert result is not None
    assert result.id == sample_order.id


async def test_get_order_not_found(db_session):
    result = await get_order(uuid.uuid4(), db_session)
    assert result is None


async def test_list_orders_all(db_session, sample_order):
    params = OrderListParams()
    orders, total = await list_orders(BUYER_WALLET, params, db_session)
    assert total == 1
    assert orders[0].id == sample_order.id


async def test_list_orders_by_role_buyer(db_session, sample_order):
    params = OrderListParams(role="buyer")
    orders, total = await list_orders(BUYER_WALLET, params, db_session)
    assert total == 1

    orders, total = await list_orders(SELLER_WALLET, params, db_session)
    assert total == 0


async def test_list_orders_by_role_seller(db_session, sample_order):
    params = OrderListParams(role="seller")
    orders, total = await list_orders(SELLER_WALLET, params, db_session)
    assert total == 1


async def test_list_orders_by_status(db_session, sample_order):
    params = OrderListParams(status=OrderStatus.CREATED)
    orders, total = await list_orders(BUYER_WALLET, params, db_session)
    assert total == 1

    params = OrderListParams(status=OrderStatus.COMPLETED)
    orders, total = await list_orders(BUYER_WALLET, params, db_session)
    assert total == 0


async def test_seller_confirm_delivery(db_session, sample_order):
    order = await seller_confirm_delivery(
        sample_order.id, "encrypted_product_key_data", db_session
    )
    assert order.status == OrderStatus.SELLER_CONFIRMED
    assert order.product_key_encrypted == "encrypted_product_key_data"
    assert order.seller_confirmed_at is not None


async def test_seller_confirm_delivery_wrong_status(db_session, confirmed_order):
    with pytest.raises(ValueError, match="INVALID_ORDER_STATUS"):
        await seller_confirm_delivery(
            confirmed_order.id, "key", db_session
        )


async def test_buyer_confirm_received(db_session, confirmed_order):
    order = await buyer_confirm_received(confirmed_order.id, db_session)
    assert order.status == OrderStatus.COMPLETED
    assert order.completed_at is not None


async def test_buyer_confirm_wrong_status(db_session, sample_order):
    with pytest.raises(ValueError, match="INVALID_ORDER_STATUS"):
        await buyer_confirm_received(sample_order.id, db_session)


async def test_cancel_order(db_session, sample_order):
    order = await cancel_order(sample_order.id, db_session)
    assert order.status == OrderStatus.CANCELLED


async def test_cancel_order_wrong_status(db_session, confirmed_order):
    with pytest.raises(ValueError, match="INVALID_ORDER_STATUS"):
        await cancel_order(confirmed_order.id, db_session)


async def test_open_dispute_from_created(db_session, sample_order):
    order = await open_dispute(sample_order.id, db_session)
    assert order.status == OrderStatus.DISPUTED
    assert order.dispute_opened_at is not None
    assert order.dispute_deadline is not None


async def test_open_dispute_from_confirmed(db_session, confirmed_order):
    order = await open_dispute(confirmed_order.id, db_session)
    assert order.status == OrderStatus.DISPUTED


async def test_open_dispute_wrong_status(db_session, completed_order):
    with pytest.raises(ValueError, match="INVALID_ORDER_STATUS"):
        await open_dispute(completed_order.id, db_session)
