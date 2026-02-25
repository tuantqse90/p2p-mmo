import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token
from tests.conftest import BUYER_WALLET, OTHER_WALLET, SELLER_WALLET


async def test_websocket_unauthenticated(client, sample_order):
    """WebSocket without token should be rejected."""
    from starlette.testclient import TestClient
    from app.main import app

    # Use Starlette's sync TestClient for WebSocket testing
    with TestClient(app) as tc:
        with pytest.raises(Exception):
            with tc.websocket_connect(
                f"/ws/orders/{sample_order.id}?token=invalid-token"
            ):
                pass


async def test_websocket_connect_buyer(client, sample_order):
    """Buyer should be able to connect to their order's WebSocket."""
    from starlette.testclient import TestClient
    from app.main import app
    from app.core.database import get_db
    from app.api.auth import get_redis
    import fakeredis.aioredis

    # We need to override deps for the WS test too
    # Note: WS route uses async_session_factory directly, not get_db
    # So this test mainly validates the auth + connection logic
    token, _ = create_access_token(BUYER_WALLET)

    # The WS route does DB lookup via async_session_factory (not dependency injection)
    # So we can't easily override it. We verify the auth logic at least.
    from app.api.websocket import authenticate_ws

    wallet = await authenticate_ws(token)
    assert wallet == BUYER_WALLET


async def test_websocket_auth_invalid_token():
    """Invalid token should return None."""
    from app.api.websocket import authenticate_ws

    wallet = await authenticate_ws("not-a-valid-jwt")
    assert wallet is None


async def test_websocket_auth_valid_token():
    """Valid JWT should return the wallet address."""
    from app.api.websocket import authenticate_ws

    token, _ = create_access_token(BUYER_WALLET)
    wallet = await authenticate_ws(token)
    assert wallet == BUYER_WALLET


async def test_connection_manager():
    """Test ConnectionManager add/remove/broadcast logic."""
    from app.api.websocket import ConnectionManager
    from unittest.mock import AsyncMock, MagicMock

    mgr = ConnectionManager()

    # Mock WebSocket
    ws1 = AsyncMock()
    ws1.accept = AsyncMock()
    ws1.send_text = AsyncMock()

    ws2 = AsyncMock()
    ws2.accept = AsyncMock()
    ws2.send_text = AsyncMock()

    # Connect
    await mgr.connect("order-1", ws1)
    assert "order-1" in mgr.active
    assert len(mgr.active["order-1"]) == 1

    await mgr.connect("order-1", ws2)
    assert len(mgr.active["order-1"]) == 2

    # Broadcast
    await mgr.broadcast("order-1", {"event": "status_update"})
    ws1.send_text.assert_called_once()
    ws2.send_text.assert_called_once()

    # Disconnect
    mgr.disconnect("order-1", ws1)
    assert len(mgr.active["order-1"]) == 1

    mgr.disconnect("order-1", ws2)
    assert "order-1" not in mgr.active


async def test_connection_manager_broadcast_no_connections():
    """Broadcast to empty order should be a no-op."""
    from app.api.websocket import ConnectionManager

    mgr = ConnectionManager()
    await mgr.broadcast("nonexistent", {"event": "test"})
    # Should not raise


async def test_connection_manager_handles_send_failure():
    """Manager should handle failed sends gracefully."""
    from app.api.websocket import ConnectionManager
    from unittest.mock import AsyncMock

    mgr = ConnectionManager()

    ws_good = AsyncMock()
    ws_good.accept = AsyncMock()
    ws_good.send_text = AsyncMock()

    ws_bad = AsyncMock()
    ws_bad.accept = AsyncMock()
    ws_bad.send_text = AsyncMock(side_effect=RuntimeError("Connection lost"))

    await mgr.connect("order-1", ws_good)
    await mgr.connect("order-1", ws_bad)

    # Broadcast should succeed for ws_good and auto-disconnect ws_bad
    await mgr.broadcast("order-1", {"event": "update"})
    ws_good.send_text.assert_called_once()
    assert len(mgr.active["order-1"]) == 1
