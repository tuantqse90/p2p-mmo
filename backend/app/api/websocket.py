import json
import logging
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.security import decode_access_token
from app.models.order import Order

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manages active WebSocket connections grouped by order_id."""

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, order_id: str, websocket: WebSocket):
        await websocket.accept()
        if order_id not in self.active:
            self.active[order_id] = []
        self.active[order_id].append(websocket)

    def disconnect(self, order_id: str, websocket: WebSocket):
        if order_id in self.active:
            self.active[order_id] = [
                ws for ws in self.active[order_id] if ws is not websocket
            ]
            if not self.active[order_id]:
                del self.active[order_id]

    async def broadcast(self, order_id: str, message: dict):
        if order_id not in self.active:
            return
        data = json.dumps(message)
        disconnected = []
        for ws in self.active[order_id]:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(order_id, ws)


manager = ConnectionManager()


async def authenticate_ws(token: str) -> str | None:
    """Validate JWT token and return wallet address."""
    wallet = decode_access_token(token)
    if wallet is None:
        return None
    return wallet


async def authorize_order(wallet: str, order_id: str) -> bool:
    """Check if wallet is a party to the order."""
    try:
        oid = uuid.UUID(order_id)
    except ValueError:
        return False

    async with async_session_factory() as db:
        result = await db.execute(select(Order).where(Order.id == oid))
        order = result.scalar_one_or_none()
        if order is None:
            return False
        return wallet in (
            order.buyer_wallet,
            order.seller_wallet,
            order.arbitrator_wallet,
        )


@router.websocket("/ws/orders/{order_id}")
async def order_websocket(
    websocket: WebSocket,
    order_id: str,
    token: str = Query(...),
):
    # Authenticate
    wallet = await authenticate_ws(token)
    if wallet is None:
        await websocket.close(code=4001, reason="UNAUTHORIZED")
        return

    # Authorize — user must be party to the order
    if not await authorize_order(wallet, order_id):
        await websocket.close(code=4003, reason="FORBIDDEN")
        return

    # Connect
    await manager.connect(order_id, websocket)
    logger.info(f"WS connected: {wallet[:10]}... to order {order_id[:8]}...")

    try:
        # Subscribe to Redis pub/sub for this order
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        pubsub = redis.pubsub()
        channel = f"order:{order_id}"
        await pubsub.subscribe(channel)

        # Two-way communication loop
        import asyncio

        async def listen_redis():
            """Forward Redis pub/sub messages to WebSocket."""
            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        await websocket.send_text(message["data"])
            except Exception:
                pass

        async def listen_ws():
            """Receive client messages and broadcast."""
            try:
                while True:
                    data = await websocket.receive_text()
                    # Parse and broadcast to other connections
                    try:
                        payload = json.loads(data)
                        payload["sender"] = wallet
                        await manager.broadcast(order_id, payload)
                        # Also publish to Redis for other server instances
                        await redis.publish(channel, json.dumps(payload))
                    except json.JSONDecodeError:
                        await websocket.send_text(
                            json.dumps({"error": "INVALID_JSON"})
                        )
            except WebSocketDisconnect:
                pass

        # Run both listeners concurrently
        redis_task = asyncio.create_task(listen_redis())
        try:
            await listen_ws()
        finally:
            redis_task.cancel()

    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception(f"WS error for order {order_id[:8]}...")
    finally:
        manager.disconnect(order_id, websocket)
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()
            await redis.aclose()
        except Exception:
            pass
        logger.info(f"WS disconnected: {wallet[:10]}... from order {order_id[:8]}...")
