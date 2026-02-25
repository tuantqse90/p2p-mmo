import uuid

from tests.conftest import ARBITRATOR_WALLET, BUYER_WALLET


async def test_submit_evidence(client, buyer_headers, disputed_order):
    resp = await client.post(
        f"/disputes/{disputed_order.id}/evidence",
        headers=buyer_headers,
        json={
            "ipfs_hash": "QmEvidence123",
            "evidence_type": "screenshot",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["ipfs_hash"] == "QmEvidence123"
    assert data["submitter_wallet"] == BUYER_WALLET


async def test_submit_evidence_seller(client, seller_headers, disputed_order):
    resp = await client.post(
        f"/disputes/{disputed_order.id}/evidence",
        headers=seller_headers,
        json={
            "ipfs_hash": "QmSellerProof",
            "evidence_type": "product_proof",
        },
    )
    assert resp.status_code == 201


async def test_submit_evidence_not_disputed(client, buyer_headers, sample_order):
    resp = await client.post(
        f"/disputes/{sample_order.id}/evidence",
        headers=buyer_headers,
        json={"ipfs_hash": "QmHash", "evidence_type": "other"},
    )
    assert resp.status_code == 400


async def test_submit_evidence_order_not_found(client, buyer_headers):
    resp = await client.post(
        f"/disputes/{uuid.uuid4()}/evidence",
        headers=buyer_headers,
        json={"ipfs_hash": "QmHash", "evidence_type": "other"},
    )
    assert resp.status_code == 404


async def test_resolve_dispute_favor_buyer(
    client, arbitrator_headers, disputed_order
):
    resp = await client.post(
        f"/disputes/{disputed_order.id}/resolve",
        headers=arbitrator_headers,
        json={"favor_buyer": True},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved_buyer"


async def test_resolve_dispute_favor_seller(
    client, arbitrator_headers, disputed_order
):
    resp = await client.post(
        f"/disputes/{disputed_order.id}/resolve",
        headers=arbitrator_headers,
        json={"favor_buyer": False},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved_seller"


async def test_resolve_dispute_not_arbitrator(
    client, buyer_headers, disputed_order
):
    resp = await client.post(
        f"/disputes/{disputed_order.id}/resolve",
        headers=buyer_headers,
        json={"favor_buyer": True},
    )
    assert resp.status_code == 403


async def test_resolve_dispute_not_found(client, arbitrator_headers):
    resp = await client.post(
        f"/disputes/{uuid.uuid4()}/resolve",
        headers=arbitrator_headers,
        json={"favor_buyer": True},
    )
    assert resp.status_code == 404
