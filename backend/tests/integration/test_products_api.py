import uuid

from tests.conftest import DEFAULT_PRODUCT_HASH, SELLER_WALLET


async def test_list_products_empty(client):
    resp = await client.get("/products")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


async def test_list_products_with_data(client, sample_product):
    resp = await client.get("/products")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title_preview"] == "Test Product"


async def test_list_products_pagination(client, sample_product):
    resp = await client.get("/products?page=1&page_size=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["page_size"] == 1


async def test_list_products_filter_category(client, sample_product):
    resp = await client.get("/products?category=tools")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0

    resp = await client.get("/products?category=data")
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


async def test_get_product(client, sample_product):
    resp = await client.get(f"/products/{sample_product.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(sample_product.id)
    assert data["seller_wallet"] == SELLER_WALLET


async def test_get_product_not_found(client):
    resp = await client.get(f"/products/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_create_product(client, seller_headers):
    resp = await client.post(
        "/products",
        headers=seller_headers,
        json={
            "title_preview": "New Listing",
            "description_preview": "Desc",
            "category": "data",
            "price_usdt": "25.50",
            "stock": 3,
            "product_hash": DEFAULT_PRODUCT_HASH,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title_preview"] == "New Listing"
    assert data["seller_wallet"] == SELLER_WALLET
    assert data["status"] == "active"


async def test_create_product_unauthenticated(client):
    resp = await client.post(
        "/products",
        json={
            "title_preview": "Fail",
            "category": "data",
            "price_usdt": "10",
            "stock": 1,
            "product_hash": DEFAULT_PRODUCT_HASH,
        },
    )
    assert resp.status_code == 403


async def test_create_product_invalid_hash(client, seller_headers):
    resp = await client.post(
        "/products",
        headers=seller_headers,
        json={
            "title_preview": "Bad Hash",
            "category": "data",
            "price_usdt": "10",
            "stock": 1,
            "product_hash": "not_a_hash",
        },
    )
    assert resp.status_code == 422


async def test_update_product(client, seller_headers, sample_product):
    resp = await client.put(
        f"/products/{sample_product.id}",
        headers=seller_headers,
        json={"title_preview": "Updated Title"},
    )
    assert resp.status_code == 200
    assert resp.json()["title_preview"] == "Updated Title"


async def test_update_product_not_owner(client, buyer_headers, sample_product):
    resp = await client.put(
        f"/products/{sample_product.id}",
        headers=buyer_headers,
        json={"title_preview": "Hijack"},
    )
    assert resp.status_code == 403


async def test_update_product_not_found(client, seller_headers):
    resp = await client.put(
        f"/products/{uuid.uuid4()}",
        headers=seller_headers,
        json={"title_preview": "Ghost"},
    )
    assert resp.status_code == 404


async def test_delete_product(client, seller_headers, sample_product):
    resp = await client.delete(
        f"/products/{sample_product.id}",
        headers=seller_headers,
    )
    assert resp.status_code == 204

    # Should no longer appear in list
    resp = await client.get(f"/products/{sample_product.id}")
    assert resp.status_code == 404


async def test_delete_product_not_owner(client, buyer_headers, sample_product):
    resp = await client.delete(
        f"/products/{sample_product.id}",
        headers=buyer_headers,
    )
    assert resp.status_code == 403
