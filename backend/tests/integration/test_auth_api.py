from eth_account import Account
from eth_account.messages import encode_defunct

from tests.conftest import DEFAULT_PUBLIC_KEY


async def test_request_nonce(client):
    resp = await client.post(
        "/auth/nonce",
        json={"wallet_address": "0x" + "a" * 40},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "nonce" in data
    assert "message" in data
    assert data["message"].startswith("P2P-Auth-")


async def test_request_nonce_invalid_wallet(client):
    resp = await client.post(
        "/auth/nonce",
        json={"wallet_address": "not_a_wallet"},
    )
    assert resp.status_code == 422


async def test_full_auth_flow(client):
    account = Account.create()
    wallet = account.address

    # Step 1: Request nonce
    resp = await client.post(
        "/auth/nonce",
        json={"wallet_address": wallet},
    )
    assert resp.status_code == 200
    message = resp.json()["message"]

    # Step 2: Sign and verify
    msg = encode_defunct(text=message)
    signed = account.sign_message(msg)

    resp = await client.post(
        "/auth/verify",
        json={
            "wallet_address": wallet,
            "signature": signed.signature.hex(),
            "public_key": DEFAULT_PUBLIC_KEY,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["wallet_address"] == wallet.lower()


async def test_verify_without_nonce(client):
    resp = await client.post(
        "/auth/verify",
        json={
            "wallet_address": "0x" + "a" * 40,
            "signature": "0x" + "b" * 130,
            "public_key": DEFAULT_PUBLIC_KEY,
        },
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "NONCE_NOT_FOUND"


async def test_verify_invalid_signature(client):
    account = Account.create()
    other_account = Account.create()
    wallet = account.address

    # Get nonce for account
    resp = await client.post(
        "/auth/nonce",
        json={"wallet_address": wallet},
    )
    message = resp.json()["message"]

    # Sign with different account
    msg = encode_defunct(text=message)
    signed = other_account.sign_message(msg)

    resp = await client.post(
        "/auth/verify",
        json={
            "wallet_address": wallet,
            "signature": signed.signature.hex(),
            "public_key": DEFAULT_PUBLIC_KEY,
        },
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "INVALID_SIGNATURE"
