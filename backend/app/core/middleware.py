"""Security middleware: rate limiting, security headers, request logging."""

import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )

        if settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self' wss: https:; "
                "frame-ancestors 'none'"
            )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting per IP. Use Redis in production."""

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_seconds = 60
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_rate_limited(self, client_ip: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old entries
        self._requests[client_ip] = [
            ts for ts in self._requests[client_ip] if ts > window_start
        ]

        if len(self._requests[client_ip]) >= self.requests_per_minute:
            return True

        self._requests[client_ip].append(now)
        return False

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        # Stricter rate limit for auth endpoints
        is_auth = request.url.path.startswith("/auth")
        limit = (
            settings.auth_rate_limit_per_minute
            if is_auth
            else self.requests_per_minute
        )

        if is_auth:
            key = f"auth:{client_ip}"
        else:
            key = client_ip

        now = time.time()
        window_start = now - self.window_seconds
        self._requests[key] = [
            ts for ts in self._requests[key] if ts > window_start
        ]

        if len(self._requests[key]) >= limit:
            return Response(
                content='{"detail":"Rate limit exceeded. Try again later."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(self.window_seconds)},
            )

        self._requests[key].append(now)
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log request method, path, status, and duration. Never log secrets."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        # Only log non-health requests to reduce noise
        if request.url.path != "/health":
            import logging

            logger = logging.getLogger("p2p.access")
            logger.info(
                "%s %s %d %.1fms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )

        return response
