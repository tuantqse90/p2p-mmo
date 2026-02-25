import uuid
from collections.abc import AsyncGenerator
from decimal import Decimal

import fakeredis.aioredis
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.models.base import (
    Base,
    ChainType,
    OrderStatus,
    ProductCategory,
    ProductStatus,
    TokenType,
    UserTier,
)
from app.models.dispute import DisputeEvidence
from app.models.message import Message
from app.models.order import Order
from app.models.product import Product
from app.models.review import Review
from app.models.user import UserProfile

# --- Constants ---
BUYER_WALLET = "0x" + "a" * 40
SELLER_WALLET = "0x" + "b" * 40
ARBITRATOR_WALLET = "0x" + "c" * 40
OTHER_WALLET = "0x" + "d" * 40
DEFAULT_TX_HASH = "0x" + "f" * 64
DEFAULT_PRODUCT_HASH = "0x" + "e" * 64
DEFAULT_PUBLIC_KEY = "A" * 88

# --- Test Database ---
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# --- Core Fixtures ---


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def redis_client():
    redis = fakeredis.aioredis.FakeRedis()
    yield redis
    await redis.aclose()


@pytest_asyncio.fixture
async def client(
    db_session: AsyncSession, redis_client
) -> AsyncGenerator[AsyncClient, None]:
    from app.api.auth import get_redis
    from app.core.database import get_db
    from app.main import app

    async def override_get_db():
        yield db_session

    async def override_get_redis():
        yield redis_client

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


# --- User Fixtures ---


@pytest_asyncio.fixture
async def buyer_user(db_session: AsyncSession) -> UserProfile:
    user = UserProfile(wallet=BUYER_WALLET, public_key=DEFAULT_PUBLIC_KEY)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def seller_user(db_session: AsyncSession) -> UserProfile:
    user = UserProfile(wallet=SELLER_WALLET, public_key=DEFAULT_PUBLIC_KEY)
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def arbitrator_user(db_session: AsyncSession) -> UserProfile:
    user = UserProfile(wallet=ARBITRATOR_WALLET, public_key=DEFAULT_PUBLIC_KEY)
    db_session.add(user)
    await db_session.flush()
    return user


# --- Auth Header Fixtures ---


def make_auth_headers(wallet: str) -> dict[str, str]:
    token, _ = create_access_token(wallet)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def buyer_headers(buyer_user: UserProfile) -> dict[str, str]:
    return make_auth_headers(buyer_user.wallet)


@pytest_asyncio.fixture
async def seller_headers(seller_user: UserProfile) -> dict[str, str]:
    return make_auth_headers(seller_user.wallet)


@pytest_asyncio.fixture
async def arbitrator_headers(arbitrator_user: UserProfile) -> dict[str, str]:
    return make_auth_headers(arbitrator_user.wallet)


# --- Data Fixtures ---


@pytest_asyncio.fixture
async def sample_product(
    db_session: AsyncSession, seller_user: UserProfile
) -> Product:
    product = Product(
        seller_wallet=seller_user.wallet,
        title_preview="Test Product",
        description_preview="A test product",
        category=ProductCategory.DATA,
        price_usdt=Decimal("100.000000"),
        stock=10,
        product_hash=DEFAULT_PRODUCT_HASH,
    )
    db_session.add(product)
    await db_session.flush()
    await db_session.refresh(product)
    return product


@pytest_asyncio.fixture
async def sample_order(
    db_session: AsyncSession,
    buyer_user: UserProfile,
    sample_product: Product,
) -> Order:
    order = Order(
        buyer_wallet=buyer_user.wallet,
        seller_wallet=sample_product.seller_wallet,
        product_id=sample_product.id,
        chain=ChainType.BSC,
        token=TokenType.USDT,
        amount=Decimal("100.000000"),
        platform_fee=Decimal("2.000000"),
        tx_hash_create=DEFAULT_TX_HASH,
    )
    db_session.add(order)
    await db_session.flush()
    await db_session.refresh(order)
    return order


@pytest_asyncio.fixture
async def confirmed_order(
    db_session: AsyncSession, sample_order: Order
) -> Order:
    sample_order.status = OrderStatus.SELLER_CONFIRMED
    sample_order.product_key_encrypted = "encrypted_key_data"
    await db_session.flush()
    return sample_order


@pytest_asyncio.fixture
async def completed_order(
    db_session: AsyncSession, confirmed_order: Order
) -> Order:
    confirmed_order.status = OrderStatus.COMPLETED
    await db_session.flush()
    return confirmed_order


@pytest_asyncio.fixture
async def disputed_order(
    db_session: AsyncSession, sample_order: Order, arbitrator_user: UserProfile
) -> Order:
    sample_order.status = OrderStatus.DISPUTED
    sample_order.arbitrator_wallet = arbitrator_user.wallet
    await db_session.flush()
    return sample_order
