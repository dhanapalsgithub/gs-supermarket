"""Backend API tests for R I Billing Pro (Supermarket POS + E-commerce)."""
import io
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "smallbiz743@gmail.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def user_creds():
    return {
        "email": f"TEST_user_{uuid.uuid4().hex[:8]}@example.com",
        "password": "Test@1234",
        "name": "Test User",
        "phone": "9999911111",
        "address": "Test Addr",
    }


@pytest.fixture(scope="module")
def user_token(s, user_creds):
    r = s.post(f"{API}/auth/register", json=user_creds)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == user_creds["email"].lower()
    assert data["user"]["role"] == "user"
    assert "_id" not in data["user"]
    assert "password_hash" not in data["user"]
    return data["token"]


@pytest.fixture(scope="module")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


# ----- Auth -----
class TestAuth:
    def test_login_admin(self, admin_token):
        assert admin_token

    def test_login_invalid(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_duplicate(self, s, user_creds, user_token):
        r = s.post(f"{API}/auth/register", json=user_creds)
        assert r.status_code == 400

    def test_me(self, s, user_headers, user_creds):
        r = s.get(f"{API}/auth/me", headers=user_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == user_creds["email"].lower()
        assert "password_hash" not in d

    def test_me_no_auth(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_profile_update(self, s, user_headers):
        r = s.put(f"{API}/auth/profile", headers=user_headers,
                  json={"name": "Updated Name", "phone": "8888888888", "address": "New Addr 42"})
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Name"
        # verify persisted
        r = s.get(f"{API}/auth/me", headers=user_headers)
        assert r.json()["phone"] == "8888888888"


# ----- Products -----
class TestProducts:
    def test_list_public(self, s):
        r = s.get(f"{API}/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_without_auth_forbidden(self, s):
        r = s.post(f"{API}/products", json={"name": "X", "category": "C", "price": 1})
        assert r.status_code == 401

    def test_create_with_user_forbidden(self, s, user_headers):
        r = s.post(f"{API}/products", json={"name": "X", "category": "C", "price": 1}, headers=user_headers)
        assert r.status_code == 403

    def test_admin_crud(self, s, admin_headers):
        payload = {"name": "TEST_PROD", "category": "TEST_CAT", "price": 20.0, "stock": 10, "barcode": f"TB{uuid.uuid4().hex[:6]}", "unit": "pcs"}
        r = s.post(f"{API}/products", json=payload, headers=admin_headers)
        assert r.status_code == 200
        pid = r.json()["id"]
        # update
        r = s.put(f"{API}/products/{pid}", json={"price": 25.0}, headers=admin_headers)
        assert r.status_code == 200 and r.json()["price"] == 25.0
        # delete
        r = s.delete(f"{API}/products/{pid}", headers=admin_headers)
        assert r.status_code == 200 and r.json()["deleted"] == 1

    def test_csv_import(self, s, admin_headers):
        csv_data = "name,category,price,stock,barcode,unit\n"
        bc = f"TCSV{uuid.uuid4().hex[:6]}"
        csv_data += f"TEST_CSV_A,TESTIMP,10,5,{bc},pcs\n"
        csv_data += "TEST_CSV_B,TESTIMP,20,3,,pcs\n"
        files = {"file": ("t.csv", io.BytesIO(csv_data.encode()), "text/csv")}
        r = s.post(f"{API}/products/import", files=files, headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] >= 2
        assert set(["created", "updated", "errors"]).issubset(d.keys())


# ----- Orders -----
class TestOrders:
    def _make_payload(self, prod, channel, method):
        item = {"product_id": prod["id"], "name": prod["name"], "price": prod["price"], "quantity": 1, "subtotal": prod["price"]}
        sub = prod["price"]
        tax = round(sub * 0.05, 2)
        return {
            "items": [item], "subtotal": sub, "tax_rate": 0.05, "tax_amount": tax,
            "discount": 0, "total": sub + tax, "payment_method": method,
            "amount_paid": sub + tax, "change_due": 0, "channel": channel,
            "customer_name": "T", "customer_phone": "9", "delivery_address": "addr",
        }

    def test_pos_creates_paid_confirmed(self, s, admin_headers):
        prod = s.get(f"{API}/products").json()[0]
        r = s.post(f"{API}/orders", json=self._make_payload(prod, "POS", "CASH"), headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["order_status"] == "CONFIRMED"
        assert d["payment_status"] == "PAID"
        assert d["receipt_no"].startswith("RCP-")

    def test_online_cod(self, s, user_headers):
        prod = s.get(f"{API}/products").json()[0]
        r = s.post(f"{API}/orders", json=self._make_payload(prod, "ONLINE", "COD"), headers=user_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["order_status"] == "PENDING"
        assert d["payment_status"] == "UNPAID"
        return d

    def test_online_upi(self, s, user_headers):
        prod = s.get(f"{API}/products").json()[0]
        r = s.post(f"{API}/orders", json=self._make_payload(prod, "ONLINE", "UPI"), headers=user_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["order_status"] == "PENDING"
        assert d["payment_status"] == "PAID"

    def test_orders_mine_only(self, s, user_headers):
        # ensure at least one user order
        prod = s.get(f"{API}/products").json()[0]
        s.post(f"{API}/orders", json=self._make_payload(prod, "ONLINE", "COD"), headers=user_headers)
        r = s.get(f"{API}/orders?mine=true", headers=user_headers)
        assert r.status_code == 200
        orders = r.json()
        assert len(orders) >= 1

    def test_list_without_mine_non_admin_forbidden(self, s, user_headers):
        r = s.get(f"{API}/orders", headers=user_headers)
        assert r.status_code == 403

    def test_list_without_mine_admin_ok(self, s, admin_headers):
        r = s.get(f"{API}/orders", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_status_update_flow(self, s, user_headers, admin_headers):
        prod = s.get(f"{API}/products").json()[0]
        r = s.post(f"{API}/orders", json=self._make_payload(prod, "ONLINE", "COD"), headers=user_headers)
        oid = r.json()["id"]
        # advance to CONFIRMED and PAID
        r = s.patch(f"{API}/orders/{oid}/status", json={"order_status": "CONFIRMED", "payment_status": "PAID"}, headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["order_status"] == "CONFIRMED" and d["payment_status"] == "PAID"
        # user sees change
        r = s.get(f"{API}/orders/{oid}", headers=user_headers)
        assert r.status_code == 200
        assert r.json()["order_status"] == "CONFIRMED"

    def test_status_update_non_admin_forbidden(self, s, user_headers):
        r = s.get(f"{API}/orders?mine=true", headers=user_headers)
        if r.json():
            oid = r.json()[0]["id"]
            r = s.patch(f"{API}/orders/{oid}/status", json={"order_status": "SHIPPED"}, headers=user_headers)
            assert r.status_code == 403


# ----- Wishlist -----
class TestWishlist:
    def test_wishlist_crud(self, s, user_headers):
        prod = s.get(f"{API}/products").json()[0]
        pid = prod["id"]
        r = s.post(f"{API}/wishlist", json={"product_id": pid}, headers=user_headers)
        assert r.status_code == 200
        r = s.get(f"{API}/wishlist", headers=user_headers)
        assert r.status_code == 200
        items = r.json()
        assert any(w["product"]["id"] == pid for w in items)
        r = s.delete(f"{API}/wishlist/{pid}", headers=user_headers)
        assert r.status_code == 200 and r.json()["deleted"] == 1

    def test_wishlist_requires_auth(self, s):
        r = s.get(f"{API}/wishlist")
        assert r.status_code == 401


# ----- Stats -----
class TestStats:
    def test_summary_public(self, s):
        r = s.get(f"{API}/stats/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_products", "total_orders", "total_revenue", "pending_orders"]:
            assert k in d

    def test_report_requires_admin(self, s, user_headers):
        r = s.get(f"{API}/stats/report", headers=user_headers)
        assert r.status_code == 403

    def test_report_admin(self, s, admin_headers):
        r = s.get(f"{API}/stats/report", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert len(d["today"]) == 24
        assert len(d["yesterday"]) == 24
        assert isinstance(d["top_products"], list)
