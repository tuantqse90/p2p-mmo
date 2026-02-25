import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

from app.models.user import UserProfile
from app.services.auth_service import NONCE_PREFIX, generate_nonce, verify_signature
from tests.conftest import DEFAULT_PUBLIC_KEY


async def test_generate_nonce(redis_client):
    wallet = "0x" + "a" * 40
    nonce, message = await generate_nonce(wallet, redis_client)

    assert len(nonce) == 32  # hex(16 bytes)
    assert message.startswith("P2P-Auth-")
    assert nonce in message

    # Verify stored in Redis
    stored = await redis_client.get(f"{NONCE_PREFIX}{wallet}")
    assert stored is not None
    parts = stored.decode().split(":")
    assert parts[0] == nonce


async def test_generate_nonce_lowercases_wallet(redis_client):
    wallet = "0x" + "A" * 40
    nonce, _ = await generate_nonce(wallet, redis_client)

    stored = await redis_client.get(f"{NONCE_PREFIX}{wallet.lower()}")
    assert stored is not None


async def test_verify_signature_creates_user(db_session, redis_client):
    account = Account.create()
    wallet = account.address

    # Generate nonce
    nonce, message = await generate_nonce(wallet, redis_client)

    # Sign message
    msg = encode_defunct(text=message)
    signed = account.sign_message(msg)
    signature = signed.signature.hex()

    token, expires_at = await verify_signature(
        wallet, signature, DEFAULT_PUBLIC_KEY, redis_client, db_session
    )

    assert token is not None
    assert len(token) > 0

    # User should be created
    from sqlalchemy import select

    result = await db_session.execute(
        select(UserProfile).where(UserProfile.wallet == wallet.lower())
    )
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.public_key == DEFAULT_PUBLIC_KEY


async def test_verify_signature_updates_existing_user(db_session, redis_client):
    account = Account.create()
    wallet = account.address.lower()

    # Create existing user
    user = UserProfile(wallet=wallet, public_key="old_key_" + "x" * 80)
    db_session.add(user)
    await db_session.flush()

    # Generate nonce and sign
    nonce, message = await generate_nonce(wallet, redis_client)
    msg = encode_defunct(text=message)
    signed = account.sign_message(msg)

    new_public_key = "new_key_" + "y" * 80
    token, _ = await verify_signature(
        wallet, signed.signature.hex(), new_public_key, redis_client, db_session
    )

    assert token is not None
    await db_session.refresh(user)
    assert user.public_key == new_public_key


async def test_verify_signature_no_nonce(db_session, redis_client):
    with pytest.raises(ValueError, match="NONCE_NOT_FOUND"):
        await verify_signature(
            "0x" + "a" * 40, "0x" + "b" * 130, DEFAULT_PUBLIC_KEY,
            redis_client, db_session,
        )


async def test_verify_signature_wrong_wallet(db_session, redis_client):
    account = Account.create()
    other_account = Account.create()

    nonce, message = await generate_nonce(account.address, redis_client)
    msg = encode_defunct(text=message)
    signed = other_account.sign_message(msg)  # Signed by different account

    with pytest.raises(ValueError, match="INVALID_SIGNATURE"):
        await verify_signature(
            account.address, signed.signature.hex(), DEFAULT_PUBLIC_KEY,
            redis_client, db_session,
        )


async def test_nonce_deleted_after_verify(db_session, redis_client):
    account = Account.create()
    wallet = account.address

    nonce, message = await generate_nonce(wallet, redis_client)
    msg = encode_defunct(text=message)
    signed = account.sign_message(msg)

    await verify_signature(
        wallet, signed.signature.hex(), DEFAULT_PUBLIC_KEY, redis_client, db_session
    )

    # Nonce should be deleted
    stored = await redis_client.get(f"{NONCE_PREFIX}{wallet.lower()}")
    assert stored is None
