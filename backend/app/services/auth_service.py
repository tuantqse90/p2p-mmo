import secrets
from datetime import datetime

from eth_account.messages import encode_defunct
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3

from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import UserProfile

NONCE_TTL = 300  # 5 minutes
NONCE_PREFIX = "auth:nonce:"


async def generate_nonce(wallet_address: str, redis: Redis) -> tuple[str, str]:
    nonce = secrets.token_hex(16)
    wallet = wallet_address.lower()
    timestamp = int(datetime.now().timestamp())
    message = f"P2P-Auth-{timestamp}-{nonce}"

    await redis.set(f"{NONCE_PREFIX}{wallet}", f"{nonce}:{timestamp}", ex=NONCE_TTL)
    return nonce, message


async def verify_signature(
    wallet_address: str,
    signature: str,
    public_key: str,
    redis: Redis,
    db: AsyncSession,
) -> tuple[str, datetime]:
    wallet = wallet_address.lower()

    # Retrieve and delete nonce
    stored = await redis.getdel(f"{NONCE_PREFIX}{wallet}")
    if stored is None:
        raise ValueError("NONCE_NOT_FOUND")

    nonce, timestamp = stored.decode().split(":")

    # Validate nonce age (max 5 minutes)
    nonce_age = int(datetime.now().timestamp()) - int(timestamp)
    if nonce_age > NONCE_TTL:
        raise ValueError("NONCE_EXPIRED")

    message = f"P2P-Auth-{timestamp}-{nonce}"

    # Verify signature recovers to wallet
    w3 = Web3()
    msg = encode_defunct(text=message)
    recovered = w3.eth.account.recover_message(msg, signature=signature)

    if recovered.lower() != wallet:
        raise ValueError("INVALID_SIGNATURE")

    # Upsert user profile
    result = await db.execute(select(UserProfile).where(UserProfile.wallet == wallet))
    user = result.scalar_one_or_none()

    if user is None:
        user = UserProfile(wallet=wallet, public_key=public_key)
        db.add(user)
    else:
        user.public_key = public_key

    await db.flush()

    # Issue JWT
    token, expires_at = create_access_token(wallet)
    return token, expires_at
