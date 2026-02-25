import httpx

from app.core.config import settings

PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"


async def pin_json(data: dict) -> str:
    headers = {
        "pinata_api_key": settings.pinata_api_key,
        "pinata_secret_api_key": settings.pinata_secret_key,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(PINATA_PIN_URL, json=data, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.json()["IpfsHash"]


async def fetch_json(ipfs_hash: str) -> dict:
    url = f"{settings.pinata_gateway_url}{ipfs_hash}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()
