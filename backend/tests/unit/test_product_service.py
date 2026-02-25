from decimal import Decimal

import pytest

from app.models.base import ProductCategory, ProductStatus
from app.models.product import Product
from app.models.user import UserProfile
from app.schemas.product import ProductCreate, ProductListParams, ProductUpdate
from app.services.product_service import (
    create_product,
    get_product,
    list_products,
    soft_delete_product,
    update_product,
)
from tests.conftest import DEFAULT_PRODUCT_HASH, SELLER_WALLET


async def test_create_product(db_session, seller_user):
    data = ProductCreate(
        title_preview="New Product",
        description_preview="Description",
        category=ProductCategory.DATA,
        price_usdt=Decimal("50.000000"),
        stock=5,
        product_hash=DEFAULT_PRODUCT_HASH,
    )
    product = await create_product(seller_user.wallet, data, db_session)

    assert product.id is not None
    assert product.seller_wallet == seller_user.wallet
    assert product.title_preview == "New Product"
    assert product.price_usdt == Decimal("50.000000")
    assert product.stock == 5
    assert product.status == ProductStatus.ACTIVE


async def test_get_product(db_session, sample_product):
    result = await get_product(sample_product.id, db_session)
    assert result is not None
    assert result.id == sample_product.id
    assert result.title_preview == sample_product.title_preview


async def test_get_product_not_found(db_session):
    import uuid

    result = await get_product(uuid.uuid4(), db_session)
    assert result is None


async def test_list_products_returns_active(db_session, sample_product):
    params = ProductListParams()
    products, total = await list_products(params, db_session)

    assert total == 1
    assert len(products) == 1
    assert products[0].id == sample_product.id


async def test_list_products_excludes_deleted(db_session, sample_product):
    await soft_delete_product(sample_product, db_session)

    params = ProductListParams()
    products, total = await list_products(params, db_session)
    assert total == 0


async def test_list_products_filter_by_category(db_session, seller_user):
    data1 = ProductCreate(
        title_preview="Data Product",
        category=ProductCategory.DATA,
        price_usdt=Decimal("10"),
        stock=1,
        product_hash="0x" + "a" * 64,
    )
    data2 = ProductCreate(
        title_preview="Tools Product",
        category=ProductCategory.TOOLS,
        price_usdt=Decimal("20"),
        stock=1,
        product_hash="0x" + "b" * 64,
    )
    await create_product(seller_user.wallet, data1, db_session)
    await create_product(seller_user.wallet, data2, db_session)

    params = ProductListParams(category=ProductCategory.DATA)
    products, total = await list_products(params, db_session)
    assert total == 1
    assert products[0].category == ProductCategory.DATA


async def test_list_products_filter_by_price(db_session, seller_user):
    for price in [Decimal("10"), Decimal("50"), Decimal("100")]:
        data = ProductCreate(
            title_preview=f"Product ${price}",
            category=ProductCategory.DATA,
            price_usdt=price,
            stock=1,
            product_hash=f"0x{str(int(price)):0>64}",
        )
        await create_product(seller_user.wallet, data, db_session)

    params = ProductListParams(min_price=Decimal("20"), max_price=Decimal("60"))
    products, total = await list_products(params, db_session)
    assert total == 1
    assert products[0].price_usdt == Decimal("50")


async def test_list_products_search(db_session, seller_user):
    for title in ["Alpha Widget", "Beta Gadget", "Alpha Tool"]:
        data = ProductCreate(
            title_preview=title,
            category=ProductCategory.DATA,
            price_usdt=Decimal("10"),
            stock=1,
            product_hash=f"0x{hash(title) % (16**64):064x}",
        )
        await create_product(seller_user.wallet, data, db_session)

    params = ProductListParams(search="Alpha")
    products, total = await list_products(params, db_session)
    assert total == 2


async def test_list_products_pagination(db_session, seller_user):
    for i in range(5):
        data = ProductCreate(
            title_preview=f"Product {i}",
            category=ProductCategory.DATA,
            price_usdt=Decimal("10"),
            stock=1,
            product_hash=f"0x{i:064x}",
        )
        await create_product(seller_user.wallet, data, db_session)

    params = ProductListParams(page=1, page_size=2)
    products, total = await list_products(params, db_session)
    assert total == 5
    assert len(products) == 2

    params = ProductListParams(page=3, page_size=2)
    products, total = await list_products(params, db_session)
    assert total == 5
    assert len(products) == 1


async def test_update_product(db_session, sample_product):
    data = ProductUpdate(title_preview="Updated Title", price_usdt=Decimal("200"))
    updated = await update_product(sample_product, data, db_session)

    assert updated.title_preview == "Updated Title"
    assert updated.price_usdt == Decimal("200")
    assert updated.stock == sample_product.stock  # unchanged


async def test_update_product_partial(db_session, sample_product):
    data = ProductUpdate(stock=99)
    updated = await update_product(sample_product, data, db_session)

    assert updated.stock == 99
    assert updated.title_preview == "Test Product"  # unchanged


async def test_soft_delete_product(db_session, sample_product):
    deleted = await soft_delete_product(sample_product, db_session)

    assert deleted.status == ProductStatus.DELETED
    assert deleted.deleted_at is not None
