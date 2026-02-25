import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import EvidenceType, OrderStatus
from app.models.dispute import DisputeEvidence
from app.models.order import Order


async def submit_evidence(
    order_id: uuid.UUID,
    submitter_wallet: str,
    ipfs_hash: str,
    evidence_type: EvidenceType,
    db: AsyncSession,
) -> DisputeEvidence:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise ValueError("NOT_FOUND")
    if order.status != OrderStatus.DISPUTED:
        raise ValueError("ORDER_NOT_CANCELLABLE")
    if submitter_wallet not in (order.buyer_wallet, order.seller_wallet):
        raise ValueError("FORBIDDEN")

    evidence = DisputeEvidence(
        order_id=order_id,
        submitter_wallet=submitter_wallet,
        ipfs_hash=ipfs_hash,
        evidence_type=evidence_type,
    )
    db.add(evidence)
    await db.flush()
    await db.refresh(evidence)
    return evidence


async def resolve_dispute(
    order_id: uuid.UUID,
    arbitrator_wallet: str,
    favor_buyer: bool,
    db: AsyncSession,
) -> Order:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if order is None:
        raise ValueError("NOT_FOUND")
    if order.status != OrderStatus.DISPUTED:
        raise ValueError("ORDER_NOT_CANCELLABLE")
    if order.arbitrator_wallet != arbitrator_wallet:
        raise ValueError("NOT_ARBITRATOR")

    order.status = OrderStatus.RESOLVED_BUYER if favor_buyer else OrderStatus.RESOLVED_SELLER
    await db.flush()
    await db.refresh(order)
    return order
