import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import ProductStatus
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductListParams, ProductUpdate


async def create_product(seller_wallet: str, data: ProductCreate, db: AsyncSession) -> Product:
    product = Product(
        seller_wallet=seller_wallet,
        title_preview=data.title_preview,
        description_preview=data.description_preview,
        category=data.category,
        price_usdt=data.price_usdt,
        stock=data.stock,
        product_hash=data.product_hash,
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


async def get_product(product_id: uuid.UUID, db: AsyncSession) -> Product | None:
    result = await db.execute(select(Product).where(Product.id == product_id))
    return result.scalar_one_or_none()


async def list_products(
    params: ProductListParams, db: AsyncSession
) -> tuple[list[Product], int]:
    query = select(Product).where(
        Product.status == ProductStatus.ACTIVE,
        Product.deleted_at.is_(None),
    )

    if params.category:
        query = query.where(Product.category == params.category)
    if params.min_price is not None:
        query = query.where(Product.price_usdt >= params.min_price)
    if params.max_price is not None:
        query = query.where(Product.price_usdt <= params.max_price)
    if params.search:
        query = query.where(Product.title_preview.ilike(f"%{params.search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Sort (whitelist allowed columns to prevent arbitrary attribute access)
    allowed_sort_columns = {
        "created_at": Product.created_at,
        "price_usdt": Product.price_usdt,
        "title_preview": Product.title_preview,
        "total_sold": Product.total_sold,
    }
    sort_col = allowed_sort_columns.get(params.sort_by, Product.created_at)
    if params.sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    # Paginate
    offset = (params.page - 1) * params.page_size
    query = query.offset(offset).limit(params.page_size)

    result = await db.execute(query)
    return list(result.scalars().all()), total


async def update_product(
    product: Product, data: ProductUpdate, db: AsyncSession
) -> Product:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.flush()
    await db.refresh(product)
    return product


async def soft_delete_product(product: Product, db: AsyncSession) -> Product:
    product.status = ProductStatus.DELETED
    product.deleted_at = datetime.now(UTC)
    await db.flush()
    return product
