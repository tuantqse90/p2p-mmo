import uuid

from tests.conftest import BUYER_WALLET, SELLER_WALLET


async def test_send_message(client, buyer_headers, sample_order):
    resp = await client.post(
        f"/orders/{sample_order.id}/messages",
        headers=buyer_headers,
        json={
            "ciphertext": "encrypted_content_base64",
            "nonce": "nonce_value_base64",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["sender_wallet"] == BUYER_WALLET
    assert data["ciphertext"] == "encrypted_content_base64"
    assert data["nonce"] == "nonce_value_base64"


async def test_send_message_seller(client, seller_headers, sample_order):
    resp = await client.post(
        f"/orders/{sample_order.id}/messages",
        headers=seller_headers,
        json={"ciphertext": "seller_reply", "nonce": "nonce2"},
    )
    assert resp.status_code == 201
    assert resp.json()["sender_wallet"] == SELLER_WALLET


async def test_send_message_order_not_found(client, buyer_headers):
    resp = await client.post(
        f"/orders/{uuid.uuid4()}/messages",
        headers=buyer_headers,
        json={"ciphertext": "text", "nonce": "n"},
    )
    assert resp.status_code == 404


async def test_get_messages(client, buyer_headers, sample_order):
    # Send two messages
    await client.post(
        f"/orders/{sample_order.id}/messages",
        headers=buyer_headers,
        json={"ciphertext": "msg1", "nonce": "n1"},
    )
    await client.post(
        f"/orders/{sample_order.id}/messages",
        headers=buyer_headers,
        json={"ciphertext": "msg2", "nonce": "n2"},
    )

    resp = await client.get(
        f"/orders/{sample_order.id}/messages",
        headers=buyer_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["items"][0]["ciphertext"] == "msg1"
    assert data["items"][1]["ciphertext"] == "msg2"


async def test_get_messages_empty(client, buyer_headers, sample_order):
    resp = await client.get(
        f"/orders/{sample_order.id}/messages",
        headers=buyer_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_get_messages_order_not_found(client, buyer_headers):
    resp = await client.get(
        f"/orders/{uuid.uuid4()}/messages",
        headers=buyer_headers,
    )
    assert resp.status_code == 404


async def test_send_message_unauthenticated(client, sample_order):
    resp = await client.post(
        f"/orders/{sample_order.id}/messages",
        json={"ciphertext": "text", "nonce": "n"},
    )
    assert resp.status_code == 403
