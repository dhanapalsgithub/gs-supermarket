"""Backend API tests for Supermarket POS."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://store-cashier-pro.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---- Products ----
def test_list_products(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 80  # seeded 87
    p = data[0]
    for k in ["id", "name", "category", "price"]:
        assert k in p


def test_list_categories(s):
    r = s.get(f"{API}/categories")
    assert r.status_code == 200
    cats = r.json()
    assert isinstance(cats, list)
    for expected in ["GROCERY", "SNACKS", "BEVERAGES", "PERSONAL_CARE"]:
        assert expected in cats


def test_barcode_lookup_himalaya(s):
    r = s.get(f"{API}/products/barcode/8901138836108")
    assert r.status_code == 200
    d = r.json()
    assert "HIMALAYA TOOTHPASTE 150G" in d["name"]
    assert d["category"] == "PERSONAL_CARE"
    assert d["price"] == 110.0


def test_barcode_not_found(s):
    r = s.get(f"{API}/products/barcode/NONEXISTENT999")
    assert r.status_code == 404


def test_search_query(s):
    r = s.get(f"{API}/products", params={"q": "coke"})
    assert r.status_code == 200
    names = [p["name"].lower() for p in r.json()]
    assert any("coke" in n for n in names)


def test_category_filter(s):
    r = s.get(f"{API}/products", params={"category": "BEVERAGES"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert all(p["category"] == "BEVERAGES" for p in data)


def test_product_crud(s):
    payload = {"name": "TEST_PRODUCT_XYZ", "category": "TEST_CAT", "price": 12.5, "stock": 5, "barcode": "TEST123", "unit": "PC"}
    r = s.post(f"{API}/products", json=payload)
    assert r.status_code == 200
    p = r.json()
    assert p["name"] == "TEST_PRODUCT_XYZ"
    assert p["price"] == 12.5
    pid = p["id"]

    # Update
    r = s.put(f"{API}/products/{pid}", json={"price": 15.0})
    assert r.status_code == 200
    assert r.json()["price"] == 15.0

    # Verify persisted via search
    r = s.get(f"{API}/products", params={"q": "TEST_PRODUCT_XYZ"})
    assert any(x["id"] == pid and x["price"] == 15.0 for x in r.json())

    # Delete
    r = s.delete(f"{API}/products/{pid}")
    assert r.status_code == 200
    assert r.json()["deleted"] == 1


# ---- Sales ----
def test_create_sale_and_stock_decrement(s):
    # Get a product
    r = s.get(f"{API}/products/barcode/8901138836108")
    prod = r.json()
    initial_stock = prod["stock"]

    sale_items = [{
        "product_id": prod["id"],
        "name": prod["name"],
        "price": prod["price"],
        "quantity": 2,
        "subtotal": prod["price"] * 2,
    }]
    subtotal = prod["price"] * 2
    tax_amt = round(subtotal * 0.05, 2)
    total = subtotal + tax_amt
    payload = {
        "items": sale_items,
        "subtotal": subtotal,
        "tax_rate": 0.05,
        "tax_amount": tax_amt,
        "discount": 0,
        "total": total,
        "payment_method": "CASH",
        "amount_paid": total,
        "change_due": 0,
        "customer_name": "TEST_CUST",
        "customer_phone": "9999999999",
    }
    r = s.post(f"{API}/sales", json=payload)
    assert r.status_code == 200, r.text
    sale = r.json()
    assert sale["receipt_no"].startswith("RCP-")
    assert sale["total"] == total
    sale_id = sale["id"]

    # Verify stock decremented
    r = s.get(f"{API}/products/barcode/8901138836108")
    assert r.json()["stock"] == initial_stock - 2

    # Get sale by id
    r = s.get(f"{API}/sales/{sale_id}")
    assert r.status_code == 200
    assert r.json()["receipt_no"] == sale["receipt_no"]


def test_list_sales_newest_first(s):
    r = s.get(f"{API}/sales")
    assert r.status_code == 200
    sales = r.json()
    assert isinstance(sales, list)
    if len(sales) >= 2:
        assert sales[0]["created_at"] >= sales[1]["created_at"]


def test_stats_summary(s):
    r = s.get(f"{API}/stats/summary")
    assert r.status_code == 200
    d = r.json()
    for k in ["total_products", "total_sales", "total_revenue"]:
        assert k in d
    assert d["total_products"] >= 80
    assert d["total_sales"] >= 1
