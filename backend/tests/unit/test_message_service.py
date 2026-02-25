import uuid

import pytest

from app.services.message_service import create_message, get_messages
from tests.conftest import ARBITRATOR_WALLET, BUYER_WALLET, OTHER_WALLET, SELLER_WALLET


async def test_create_message_buyer(db_session, sample_order):
    msg = await create_message(
        sample_order.id, BUYER_WALLET, "encrypted_text", "nonce123", db_session
    )
    assert msg.id is not None
    assert msg.order_id == sample_order.id
    assert msg.sender_wallet == BUYER_WALLET
    assert msg.ciphertext == "encrypted_text"
    assert msg.nonce == "nonce123"


async def test_create_message_seller(db_session, sample_order):
    msg = await create_message(
        sample_order.id, SELLER_WALLET, "reply_encrypted", "nonce456", db_session
    )
    assert msg.sender_wallet == SELLER_WALLET


async def test_create_message_order_not_found(db_session):
    with pytest.raises(ValueError, match="NOT_FOUND"):
        await create_message(
            uuid.uuid4(), BUYER_WALLET, "text", "nonce", db_session
        )


async def test_create_message_not_party(db_session, sample_order):
    with pytest.raises(ValueError, match="FORBIDDEN"):
        await create_message(
            sample_order.id, OTHER_WALLET, "text", "nonce", db_session
        )


async def test_get_messages(db_session, sample_order):
    await create_message(
        sample_order.id, BUYER_WALLET, "msg1", "nonce1", db_session
    )
    await create_message(
        sample_order.id, SELLER_WALLET, "msg2", "nonce2", db_session
    )

    messages = await get_messages(sample_order.id, BUYER_WALLET, db_session)
    assert len(messages) == 2
    assert messages[0].ciphertext == "msg1"
    assert messages[1].ciphertext == "msg2"


async def test_get_messages_order_not_found(db_session):
    with pytest.raises(ValueError, match="NOT_FOUND"):
        await get_messages(uuid.uuid4(), BUYER_WALLET, db_session)


async def test_get_messages_not_party(db_session, sample_order):
    with pytest.raises(ValueError, match="FORBIDDEN"):
        await get_messages(sample_order.id, OTHER_WALLET, db_session)


async def test_get_messages_empty(db_session, sample_order):
    messages = await get_messages(sample_order.id, BUYER_WALLET, db_session)
    assert messages == []
