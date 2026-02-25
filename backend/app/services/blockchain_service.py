import json
from pathlib import Path

from web3 import AsyncWeb3
from web3.middleware import ExtraDataToPOAMiddleware

from app.core.config import settings

# Load ABIs from contracts build output
ABI_DIR = Path(__file__).parent.parent.parent.parent / "contracts" / "out"


def _load_abi(contract_name: str) -> list:
    abi_path = ABI_DIR / f"{contract_name}.sol" / f"{contract_name}.json"
    if abi_path.exists():
        with open(abi_path) as f:
            data = json.load(f)
            return data.get("abi", [])
    return []


def get_web3() -> AsyncWeb3:
    w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(settings.bsc_rpc_url))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return w3


def get_escrow_contract(w3: AsyncWeb3):
    abi = _load_abi("P2PEscrow")
    return w3.eth.contract(
        address=w3.to_checksum_address(settings.escrow_contract_address),
        abi=abi,
    )


def get_arbitrator_pool_contract(w3: AsyncWeb3):
    abi = _load_abi("ArbitratorPool")
    return w3.eth.contract(
        address=w3.to_checksum_address(settings.arbitrator_pool_address),
        abi=abi,
    )


async def verify_tx_confirmed(tx_hash: str) -> bool:
    w3 = get_web3()
    try:
        receipt = await w3.eth.get_transaction_receipt(tx_hash)
        if receipt is None:
            return False
        block = await w3.eth.get_block_number()
        confirmations = block - receipt["blockNumber"]
        return confirmations >= settings.bsc_block_confirmations
    except Exception:
        return False


async def get_latest_block() -> int:
    w3 = get_web3()
    return await w3.eth.get_block_number()
