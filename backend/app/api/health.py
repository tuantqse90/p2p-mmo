from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import async_session_factory

router = APIRouter()


@router.get("/health")
async def health_check():
    checks = {"api": "ok", "database": "unknown"}

    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "checks": checks}
