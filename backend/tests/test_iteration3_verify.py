"""Iteration 3: Verify GS dummy data seeded and Atlas migration works."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://store-cashier-pro.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER = {"email": "smallbiz743@gmail.com", "password": "Admin@123"}
CASHIER = {"email": "cashier@gs.com", "password": "Cashier@123"}
USER = {"email": "aarav@example.com", "password": "Demo@1234"}

GS_BARCODES = [f"GS{str(i).zfill(4)}" for i in range(1, 11)]


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login {creds['email']} -> {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in {data}"
    return tok, data.get("user", {})


def test_owner_login():
    tok, user = _login(OWNER)
    assert user.get("role") == "owner"


def test_cashier_login():
    tok, user = _login(CASHIER)
    assert user.get("role") == "cashier"


def test_user_login():
    tok, user = _login(USER)
    assert user.get("role") == "user"


def test_products_include_gs_barcodes():
    r = requests.get(f"{API}/products", timeout=20)
    assert r.status_code == 200
    products = r.json()
    assert isinstance(products, list)
    print(f"Total products: {len(products)}")
    barcodes = {p.get("barcode") for p in products}
    missing = [b for b in GS_BARCODES if b not in barcodes]
    assert not missing, f"Missing GS barcodes: {missing}"
    assert len(products) >= 90, f"Expected ~99 products, got {len(products)}"


def test_categories_seeded():
    r = requests.get(f"{API}/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()
    assert len(cats) >= 5, f"Expected ~10 categories, got {len(cats)}"


def test_admin_orders_list():
    tok, _ = _login(OWNER)
    r = requests.get(f"{API}/orders", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    assert r.status_code == 200
    orders = r.json()
    assert isinstance(orders, list)
    print(f"Total orders: {len(orders)}")
    assert len(orders) >= 10, f"Expected >=10 orders, got {len(orders)}"
    statuses = {o.get("status") for o in orders}
    print(f"Order statuses present: {statuses}")


def test_user_my_orders():
    tok, _ = _login(USER)
    r = requests.get(f"{API}/orders?mine=true", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    assert r.status_code == 200
    orders = r.json()
    print(f"aarav orders: {len(orders)}")


def test_user_wishlist():
    tok, _ = _login(USER)
    r = requests.get(f"{API}/wishlist", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    assert r.status_code == 200
    wl = r.json()
    print(f"aarav wishlist: {len(wl)}")
    assert len(wl) >= 1, "expected 1 wishlist item"


def test_reports():
    tok, _ = _login(OWNER)
    r = requests.get(f"{API}/stats/report", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "today" in d and "yesterday" in d


def test_settings():
    tok, _ = _login(OWNER)
    r = requests.get(f"{API}/settings", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    assert r.status_code == 200


def test_cashier_pos_products():
    tok, _ = _login(CASHIER)
    r = requests.get(f"{API}/products", headers={"Authorization": f"Bearer {tok}"}, timeout=15)
    assert r.status_code == 200
    assert len(r.json()) >= 90
