from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.auth import NonceRequest, NonceResponse, TokenResponse, VerifyRequest
from app.services import auth_service

router = APIRouter()


async def get_redis() -> Redis:
    from app.core.config import settings

    r = Redis.from_url(settings.redis_url, decode_responses=False)
    try:
        yield r
    finally:
        await r.aclose()


@router.post("/nonce", response_model=NonceResponse)
async def request_nonce(body: NonceRequest, redis: Redis = Depends(get_redis)):
    nonce, message = await auth_service.generate_nonce(body.wallet_address, redis)
    return NonceResponse(nonce=nonce, message=message)


@router.post("/verify", response_model=TokenResponse)
async def verify_signature(
    body: VerifyRequest,
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    try:
        token, expires_at = await auth_service.verify_signature(
            body.wallet_address, body.signature, body.public_key, redis, db
        )
    except ValueError as e:
        code = str(e)
        if code == "NONCE_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=code)
        if code == "INVALID_SIGNATURE":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=code)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code)

    return TokenResponse(
        token=token,
        expires_at=expires_at,
        wallet_address=body.wallet_address.lower(),
    )
