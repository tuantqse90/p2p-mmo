import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.base import ProductCategory, ProductStatus


class ProductCreate(BaseModel):
    title_preview: str = Field(..., min_length=1, max_length=100)
    description_preview: str | None = Field(None, max_length=500)
    category: ProductCategory
    price_usdt: Decimal = Field(..., gt=0, decimal_places=6)
    stock: int = Field(..., ge=0)
    product_hash: str = Field(..., pattern=r"^0x[a-fA-F0-9]{64}$")


class ProductUpdate(BaseModel):
    title_preview: str | None = Field(None, min_length=1, max_length=100)
    description_preview: str | None = Field(None, max_length=500)
    price_usdt: Decimal | None = Field(None, gt=0, decimal_places=6)
    stock: int | None = Field(None, ge=0)
    status: ProductStatus | None = None


class ProductResponse(BaseModel):
    id: uuid.UUID
    seller_wallet: str
    title_preview: str
    description_preview: str | None
    category: ProductCategory
    price_usdt: Decimal
    stock: int
    total_sold: int
    product_hash: str
    status: ProductStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    category: ProductCategory | None = None
    min_price: Decimal | None = None
    max_price: Decimal | None = None
    search: str | None = Field(None, max_length=100)
    sort_by: str = Field("created_at", pattern=r"^(created_at|price_usdt|total_sold)$")
    sort_order: str = Field("desc", pattern=r"^(asc|desc)$")
