import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.base import ProductCategory, ProductStatus
from app.models.user import UserProfile
from app.schemas.common import PaginatedResponse
from app.schemas.product import ProductCreate, ProductListParams, ProductResponse, ProductUpdate
from app.services import product_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[ProductResponse])
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: ProductCategory | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    search: str | None = None,
    sort_by: str = Query("created_at", pattern=r"^(created_at|price_usdt|total_sold)$"),
    sort_order: str = Query("desc", pattern=r"^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
):
    params = ProductListParams(
        page=page,
        page_size=page_size,
        category=category,
        min_price=min_price,
        max_price=max_price,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    products, total = await product_service.list_products(params, db)
    return PaginatedResponse(
        items=[ProductResponse.model_validate(p) for p in products],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    product = await product_service.get_product(product_id, db)
    if product is None or product.status == ProductStatus.DELETED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    return ProductResponse.model_validate(product)


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreate,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await product_service.create_product(user.wallet, body, db)
    return ProductResponse.model_validate(product)


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    body: ProductUpdate,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await product_service.get_product(product_id, db)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    if product.seller_wallet != user.wallet:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="NOT_SELLER")

    product = await product_service.update_product(product, body, db)
    return ProductResponse.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = await product_service.get_product(product_id, db)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NOT_FOUND")
    if product.seller_wallet != user.wallet:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="NOT_SELLER")

    await product_service.soft_delete_product(product, db)
