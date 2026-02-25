import asyncio
import logging

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.base import ChainType, OrderStatus
from app.models.event_sync import EventSyncCursor
from app.models.order import Order
from app.services.blockchain_service import get_escrow_contract, get_web3
from app.workers import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.event_listener.sync_events")
def sync_events():
    asyncio.get_event_loop().run_until_complete(_sync_events())


async def _sync_events():
    w3 = get_web3()
    escrow = get_escrow_contract(w3)

    async with async_session_factory() as db:
        # Get last synced block
        result = await db.execute(
            select(EventSyncCursor).where(EventSyncCursor.chain == ChainType.BSC)
        )
        cursor = result.scalar_one_or_none()
        if cursor is None:
            latest = await w3.eth.get_block_number()
            cursor = EventSyncCursor(
                chain=ChainType.BSC,
                contract=escrow.address,
                last_block=latest,
            )
            db.add(cursor)
            await db.commit()
            return

        from_block = cursor.last_block + 1
        to_block = await w3.eth.get_block_number()

        if from_block > to_block:
            return

        # Cap batch size to prevent RPC overload
        to_block = min(to_block, from_block + 2000)

        try:
            # Process OrderCreated events
            events = await escrow.events.OrderCreated.get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                args = event["args"]
                # Update order with on-chain ID if matched by tx_hash
                tx_hash = event["transactionHash"].hex()
                result = await db.execute(
                    select(Order).where(Order.tx_hash_create == f"0x{tx_hash}")
                )
                order = result.scalar_one_or_none()
                if order:
                    order.onchain_order_id = args["orderId"]

            # Process SellerConfirmed events
            events = await escrow.events.SellerConfirmed.get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                args = event["args"]
                result = await db.execute(
                    select(Order).where(Order.onchain_order_id == args["orderId"])
                )
                order = result.scalar_one_or_none()
                if order and order.status == OrderStatus.CREATED:
                    order.status = OrderStatus.SELLER_CONFIRMED

            # Process OrderCompleted events
            events = await escrow.events.OrderCompleted.get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                args = event["args"]
                result = await db.execute(
                    select(Order).where(Order.onchain_order_id == args["orderId"])
                )
                order = result.scalar_one_or_none()
                if order and order.status == OrderStatus.SELLER_CONFIRMED:
                    order.status = OrderStatus.COMPLETED

            # Process DisputeOpened events
            events = await escrow.events.DisputeOpened.get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                args = event["args"]
                result = await db.execute(
                    select(Order).where(Order.onchain_order_id == args["orderId"])
                )
                order = result.scalar_one_or_none()
                if order:
                    order.status = OrderStatus.DISPUTED

            # Process DisputeResolved events
            events = await escrow.events.DisputeResolved.get_logs(
                fromBlock=from_block, toBlock=to_block
            )
            for event in events:
                args = event["args"]
                result = await db.execute(
                    select(Order).where(Order.onchain_order_id == args["orderId"])
                )
                order = result.scalar_one_or_none()
                if order:
                    order.status = (
                        OrderStatus.RESOLVED_BUYER if args["favorBuyer"]
                        else OrderStatus.RESOLVED_SELLER
                    )

            # Update cursor
            cursor.last_block = to_block
            await db.commit()

        except Exception:
            logger.exception("Error syncing BSC events")
            await db.rollback()
