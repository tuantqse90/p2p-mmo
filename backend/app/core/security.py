from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.core.config import settings


def create_access_token(wallet_address: str) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {
        "sub": wallet_address.lower(),
        "exp": expires_at,
        "iat": datetime.now(UTC),
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        wallet: str | None = payload.get("sub")
        return wallet
    except JWTError:
        return None
