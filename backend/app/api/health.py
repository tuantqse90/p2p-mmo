from fastapi import APIRouter
from redis.asyncio import Redis
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session_factory
from app.workers import celery_app

router = APIRouter()


@router.get("/health")
async def health_check():
    checks = {"api": "ok", "database": "unknown", "redis": "unknown", "celery": "unknown"}

    # Database check
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    # Redis check
    try:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        await redis.ping()
        await redis.aclose()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    # Celery check
    try:
        inspect = celery_app.control.inspect()
        active = inspect.active_queues()
        checks["celery"] = "ok" if active else "error"
    except Exception:
        checks["celery"] = "error"

    health_status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": health_status, "checks": checks}
