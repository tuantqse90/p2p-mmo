import uuid

import pytest

from app.models.base import EvidenceType, OrderStatus
from app.services.dispute_service import resolve_dispute, submit_evidence
from tests.conftest import (
    ARBITRATOR_WALLET,
    BUYER_WALLET,
    OTHER_WALLET,
    SELLER_WALLET,
)


async def test_submit_evidence(db_session, disputed_order):
    evidence = await submit_evidence(
        disputed_order.id,
        BUYER_WALLET,
        "QmTestHash123",
        EvidenceType.SCREENSHOT,
        db_session,
    )
    assert evidence.id is not None
    assert evidence.order_id == disputed_order.id
    assert evidence.submitter_wallet == BUYER_WALLET
    assert evidence.ipfs_hash == "QmTestHash123"
    assert evidence.evidence_type == EvidenceType.SCREENSHOT


async def test_submit_evidence_seller(db_session, disputed_order):
    evidence = await submit_evidence(
        disputed_order.id,
        SELLER_WALLET,
        "QmSellerEvidence",
        EvidenceType.PRODUCT_PROOF,
        db_session,
    )
    assert evidence.submitter_wallet == SELLER_WALLET


async def test_submit_evidence_order_not_found(db_session):
    with pytest.raises(ValueError, match="NOT_FOUND"):
        await submit_evidence(
            uuid.uuid4(), BUYER_WALLET, "QmHash", EvidenceType.OTHER, db_session
        )


async def test_submit_evidence_order_not_disputed(db_session, sample_order):
    with pytest.raises(ValueError, match="ORDER_NOT_CANCELLABLE"):
        await submit_evidence(
            sample_order.id, BUYER_WALLET, "QmHash", EvidenceType.OTHER, db_session
        )


async def test_submit_evidence_not_party(db_session, disputed_order):
    with pytest.raises(ValueError, match="FORBIDDEN"):
        await submit_evidence(
            disputed_order.id, OTHER_WALLET, "QmHash", EvidenceType.OTHER, db_session
        )


async def test_resolve_dispute_favor_buyer(db_session, disputed_order):
    order = await resolve_dispute(
        disputed_order.id, ARBITRATOR_WALLET, True, db_session
    )
    assert order.status == OrderStatus.RESOLVED_BUYER


async def test_resolve_dispute_favor_seller(db_session, disputed_order):
    order = await resolve_dispute(
        disputed_order.id, ARBITRATOR_WALLET, False, db_session
    )
    assert order.status == OrderStatus.RESOLVED_SELLER


async def test_resolve_dispute_order_not_found(db_session):
    with pytest.raises(ValueError, match="NOT_FOUND"):
        await resolve_dispute(uuid.uuid4(), ARBITRATOR_WALLET, True, db_session)


async def test_resolve_dispute_not_disputed(db_session, sample_order):
    with pytest.raises(ValueError, match="ORDER_NOT_CANCELLABLE"):
        await resolve_dispute(
            sample_order.id, ARBITRATOR_WALLET, True, db_session
        )


async def test_resolve_dispute_wrong_arbitrator(db_session, disputed_order):
    with pytest.raises(ValueError, match="NOT_ARBITRATOR"):
        await resolve_dispute(
            disputed_order.id, OTHER_WALLET, True, db_session
        )
