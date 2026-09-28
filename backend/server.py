from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import bcrypt
import jwt
import uuid
import asyncio
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
ACCESS_MIN = 60 * 24 * 7  # 7 days

app = FastAPI(title="CashierPro API")
api = APIRouter(prefix="/api")


# ---------- helpers ----------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Owner only")
    return user


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("owner", "cashier"):
        raise HTTPException(status_code=403, detail="Staff only")
    return user


# ---------- settings / integrations ----------
SETTINGS_ID = "app_settings"
DEFAULT_SETTINGS = {
    "id": SETTINGS_ID,
    "sms_enabled": False,
    "payment_gateway": "SIMULATED",
    "sms_provider": "TWILIO",
    "updated_at": now_iso(),
}


async def get_settings():
    s = await db.settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if not s:
        await db.settings.insert_one(DEFAULT_SETTINGS.copy())
        s = DEFAULT_SETTINGS.copy()
    return s


class SettingsUpdate(BaseModel):
    sms_enabled: Optional[bool] = None
    payment_gateway: Optional[Literal["SIMULATED", "STRIPE", "RAZORPAY"]] = None
    sms_provider: Optional[str] = None
    
class BroadcastOfferInput(BaseModel):
    message: str


async def send_sms(phone: str, body: str) -> bool:
    if not phone:
        return False
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = os.environ.get("TWILIO_FROM_NUMBER")
    if not (sid and token and from_num):
        logger.info(f"[SMS skipped - Twilio keys missing] → {phone}: {body}")
        return False

    to = phone.strip().replace(" ", "").replace("-", "")
    if to and to[0].isdigit() and len(to) == 10:
        to = f"+91{to}"
    elif to and not to.startswith("+"):
        to = f"+{to}"

    try:
        from twilio.rest import Client  # type: ignore
        client = Client(sid, token)
        msg = await asyncio.to_thread(client.messages.create, body=body, from_=from_num, to=to)
        logger.info(f"[SMS sent] {msg.sid} → {to}")
        return True
    except Exception as e:
        logger.warning(f"[SMS failed] {to}: {e}")
        return False


async def maybe_notify_status_change(order: dict, new_order_status: Optional[str], new_payment_status: Optional[str]):
    settings = await get_settings()
    if not settings.get("sms_enabled"):
        return
    phone = order.get("customer_phone")
    if not phone:
        return
    store = "GS Supermarket"
    parts = []
    if new_order_status == "SHIPPED":
        parts.append(f"Your order {order['receipt_no']} has been SHIPPED and is on the way.")
    if new_order_status == "DELIVERED":
        parts.append(f"Your order {order['receipt_no']} was DELIVERED. Thank you for shopping at {store}!")
    if new_order_status == "CANCELLED":
        parts.append(f"Your order {order['receipt_no']} was CANCELLED. Contact {store} for details.")
    if new_payment_status == "PAID":
        parts.append(f"Payment received for {order['receipt_no']} — Rs{order['total']:.2f}. Thank you!")
    if not parts:
        return
    body = " ".join(parts)
    sent = await send_sms(phone, body)
    await db.orders.update_one(
        {"id": order["id"]},
        {"$push": {"status_history": {"at": now_iso(), "event": "SMS", "sent": sent, "body": body[:160]}}},
    )


# ---------- models ----------
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    price: float
    stock: float = 0
    barcode: Optional[str] = None
    unit: Optional[str] = "pcs"
    image_hint: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
# --- NEW PURCHASE MODEL ---
class PurchaseCreate(BaseModel):
    supplier_name: str
    product_code: str
    product_name: str
    rate: float
    closing_qty: float
    date: str  # Format: YYYY-MM-DD


class ProductCreate(BaseModel):
    name: str; category: str; price: float; stock: float = 0
    barcode: Optional[str] = None; unit: Optional[str] = "pcs"; image_hint: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None; category: Optional[str] = None; price: Optional[float] = None
    stock: Optional[float] = None; barcode: Optional[str] = None; unit: Optional[str] = None
    image_hint: Optional[str] = None


class SaleItem(BaseModel):
    product_id: str; name: str; price: float; quantity: float; subtotal: float


class OrderCreate(BaseModel):
    items: List[SaleItem]
    subtotal: float
    tax_rate: float = 0.05
    tax_amount: float = 0.0
    discount: float = 0.0
    total: float
    payment_method: Literal["CASH", "UPI", "CARD", "COD"]
    amount_paid: float = 0.0
    change_due: float = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    channel: Literal["POS", "ONLINE"] = "POS"
    cashier: Optional[str] = "Cashier"


class OrderStatusUpdate(BaseModel):
    order_status: Optional[Literal["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]] = None
    payment_status: Optional[Literal["UNPAID", "PAID", "REFUNDED"]] = None


class RegisterInput(BaseModel):
    email: EmailStr; password: str; name: str; phone: Optional[str] = None; address: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr; password: str


class WishlistItemIn(BaseModel):
    product_id: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None; phone: Optional[str] = None; address: Optional[str] = None
    
class OfferBroadcastInput(BaseModel):
    message: str


# --- NEW MODELS FOR CUSTOMERS & SUPPLIERS ---
class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None

class SupplierCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    company: Optional[str] = None
    address: Optional[str] = None


# ---------- auth endpoints ----------
@api.post("/auth/register")
async def register(payload: RegisterInput):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "password_hash": hash_pw(payload.password),
        "name": payload.name, "phone": payload.phone, "address": payload.address,
        "role": "user", "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = make_token(uid, email, "user")
    user_out = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
    return {"token": token, "user": user_out}


@api.post("/auth/login")
async def login(payload: LoginInput):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = make_token(user["id"], email, user["role"])
    u = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return {"token": token, "user": u}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.put("/auth/profile")
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})


# ---------- customers endpoints ----------
@api.get("/customers")
async def list_customers(_: dict = Depends(require_staff)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    
    for c in customers:
        if "id" not in c:
            c["id"] = str(uuid.uuid4())

    orders = await db.orders.find({}, {"_id": 0, "customer_name": 1, "customer_phone": 1, "channel": 1}).to_list(2000)
    existing_phones = {c.get("phone") for c in customers}
    
    for ord in orders:
        c_name = ord.get("customer_name")
        c_phone = ord.get("customer_phone")
        c_channel = ord.get("channel", "POS")
        
        if (c_name or c_phone) and c_phone not in existing_phones and c_phone:
            new_c = {
                "id": str(uuid.uuid4()),
                "name": c_name or "Walk-in Customer",
                "phone": c_phone,
                "email": "N/A",
                "type": "ONLINE" if c_channel == "ONLINE" else "WALKING",
                "created_at": now_iso()
            }
            await db.customers.insert_one(new_c)
            customers.append({k: v for k, v in new_c.items() if k != "_id"})
            existing_phones.add(c_phone)

    online = [c for c in customers if c.get("type") == "ONLINE" or c.get("channel") == "ONLINE"]
    walking = [c for c in customers if c not in online]

    return {
        "online": online,
        "walking": walking
    }


@api.post("/customers")
async def create_customer(payload: CustomerCreate, _: dict = Depends(require_staff)):
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "created_at": now_iso()
    }
    await db.customers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.put("/customers/{cid}")
async def update_customer(cid: str, payload: CustomerCreate, _: dict = Depends(require_staff)):
    await db.customers.update_one(
        {"$or": [{"id": cid}, {"phone": cid}]}, 
        {"$set": payload.model_dump()}
    )
    return {"ok": True}


@api.delete("/customers/{cid}")
async def delete_customer(cid: str, _: dict = Depends(require_staff)):
    await db.customers.delete_one({"$or": [{"id": cid}, {"phone": cid}]})
    return {"ok": True}


# ---------- suppliers endpoints ----------
@api.post("/suppliers")
async def create_supplier(payload: SupplierCreate, _: dict = Depends(require_owner)):
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "created_at": now_iso()
    }
    await db.suppliers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}
# ---------- suppliers endpoints ----------
@api.get("/suppliers")
async def list_suppliers(_: dict = Depends(require_staff)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    for s in suppliers:
        if "id" not in s:
            s["id"] = str(uuid.uuid4())
    return suppliers

@api.post("/suppliers")
async def create_supplier(payload: SupplierCreate, _: dict = Depends(require_owner)):
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "created_at": now_iso()
    }
    await db.suppliers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.put("/suppliers/{sid}")
async def update_supplier(sid: str, payload: SupplierCreate, _: dict = Depends(require_owner)):
    await db.suppliers.update_one(
        {"$or": [{"id": sid}, {"phone": sid}]}, 
        {"$set": payload.model_dump()}
    )
    return {"ok": True}


# ---------- product endpoints ----------
@api.get("/products")
async def list_products(q: Optional[str] = None, category: Optional[str] = None):
    query = {}
    if category and category != "ALL":
        query["category"] = category
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"barcode": {"$regex": q, "$options": "i"}}]
    docs = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(2000)
    return docs


@api.get("/products/barcode/{barcode}")
async def get_by_barcode(barcode: str):
    doc = await db.products.find_one({"barcode": barcode}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return doc


@api.post("/products")
async def create_product(payload: ProductCreate, _: dict = Depends(require_owner)):
    prod = Product(**payload.model_dump())
    await db.products.insert_one(prod.model_dump())
    return prod

@api.post("/admin/broadcast-offer")
async def broadcast_offer(payload: OfferBroadcastInput, _: dict = Depends(require_owner)):
    # டேட்டாபேஸில் ஆஃபரைச் சேமித்தல் (பயனர்கள் பார்க்க வசதியாக)
    offer_doc = {
        "id": str(uuid.uuid4()),
        "message": payload.message,
        "created_at": now_iso()
    }
    await db.offers.insert_one(offer_doc)

    # (ஏற்கனவே உள்ள Twilio SMS அனுப்புவதற்கான லஜிக் இங்கே தொடரலாம்...)
    online_customers = await db.customers.find({"$or": [{"type": "ONLINE"}, {"channel": "ONLINE"}]}, {"_id": 0, "phone": 1}).to_list(5000)
    all_phones = {c.get("phone") for c in online_customers if c.get("phone")}
    
    sent_count = 0
    for phone in all_phones:
        success = await send_sms(phone, payload.message)
        if success:
            sent_count += 1

    return {
        "success": True,
        "total_targeted": len(all_phones),
        "sent": sent_count
    }

# 2. பயனர்கள் (Users/Customers) ஆஃபர்களைப் பார்க்க புதிய API:
@api.get("/offers/active")
async def get_active_offers():
    # கடைசியாக அனுப்பப்பட்ட ஆஃபர்களைப் பெற (கடைசி 5 ஆஃபர்கள்)
    offers = await db.offers.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    return offers

@api.put("/admin/offers/{oid}")
async def update_offer(oid: str, payload: OfferBroadcastInput, _: dict = Depends(require_owner)):
    result = await db.offers.update_one({"id": oid}, {"$set": {"message": payload.message}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"ok": True}


@api.delete("/admin/offers/{oid}")
async def delete_offer(oid: str, _: dict = Depends(require_owner)):
    result = await db.offers.delete_one({"id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found")
    return {"ok": True}

@api.put("/products/{pid}")
async def update_product(pid: str, payload: ProductUpdate, _: dict = Depends(require_owner)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.products.update_one({"id": pid}, {"$set": updates})
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return doc


@api.delete("/products/{pid}")
async def delete_product(pid: str, _: dict = Depends(require_owner)):
    r = await db.products.delete_one({"id": pid})
    return {"deleted": r.deleted_count}


@api.get("/categories")
async def list_categories():
    return sorted(await db.products.distinct("category"))

# ---------- purchases endpoints ----------
@api.get("/purchases")
async def list_purchases(_: dict = Depends(require_staff)):
    purchases = await db.purchases.find({}, {"_id": 0}).to_list(2000)
    for p in purchases:
        if "id" not in p:
            p["id"] = str(uuid.uuid4())
    return purchases

@api.post("/purchases")
async def create_purchase(payload: PurchaseCreate, _: dict = Depends(require_staff)):
    closing_value = payload.rate * payload.closing_qty
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "closing_value": closing_value,
        "created_at": now_iso()
    }
    await db.purchases.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.put("/purchases/{pid}")
async def update_purchase(pid: str, payload: PurchaseCreate, _: dict = Depends(require_staff)):
    closing_value = payload.rate * payload.closing_qty
    await db.purchases.update_one(
        {"id": pid}, 
        {"$set": {**payload.model_dump(), "closing_value": closing_value}}
    )
    return {"ok": True}

@api.delete("/purchases/{pid}")
async def delete_purchase(pid: str, _: dict = Depends(require_staff)):
    await db.purchases.delete_one({"id": pid})
    return {"ok": True}

@api.post("/products/import")
async def import_products(file: UploadFile = File(...), _: dict = Depends(require_owner)):
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    created, updated, errors = 0, 0, 0
    for row in reader:
        try:
            name = (row.get("name") or "").strip()
            if not name:
                errors += 1
                continue
            barcode = (row.get("barcode") or "").strip() or None
            data = {
                "name": name,
                "category": (row.get("category") or "GROCERY").strip().upper(),
                "price": float(row.get("price") or 0),
                "stock": float(row.get("stock") or 0),
                "barcode": barcode,
                "unit": (row.get("unit") or "pcs").strip(),
            }
            existing = None
            if barcode:
                existing = await db.products.find_one({"barcode": barcode})
            if existing:
                await db.products.update_one({"id": existing["id"]}, {"$set": data})
                updated += 1
            else:
                prod = Product(**data)
                await db.products.insert_one(prod.model_dump())
                created += 1
        except Exception:
            errors += 1
    return {"created": created, "updated": updated, "errors": errors}


# ---------- orders ----------
def gen_receipt_no():
    return f"RCP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


@api.post("/orders")
async def create_order(payload: OrderCreate, request: Request):
    user_id = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            p = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALG])
            user_id = p["sub"]
        except Exception:
            pass

    channel = payload.channel
    if channel == "POS":
        payment_status = "PAID"
        order_status = "CONFIRMED"
    else:
        payment_status = "PAID" if payload.payment_method == "UPI" else "UNPAID"
        order_status = "PENDING"

    doc = {
        "id": str(uuid.uuid4()),
        "receipt_no": gen_receipt_no(),
        "user_id": user_id,
        **payload.model_dump(),
        "order_status": order_status,
        "payment_status": payment_status,
        "status_history": [{"at": now_iso(), "order_status": order_status, "payment_status": payment_status}],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(doc)
    
    for it in payload.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.quantity}})

    if payload.customer_name or payload.customer_phone:
        phone = payload.customer_phone or "N/A"
        existing_cust = await db.customers.find_one({"phone": phone})
        customer_type = "ONLINE" if channel == "ONLINE" else "WALKING"
        
        if not existing_cust:
            cust_doc = {
                "id": str(uuid.uuid4()),
                "name": payload.customer_name or "Walk-in Customer",
                "phone": phone,
                "email": getattr(payload, 'customer_email', None) or "N/A",
                "type": customer_type,
                "created_at": now_iso()
            }
            await db.customers.insert_one(cust_doc)
        else:
            await db.customers.update_one(
                {"phone": phone},
                {"$set": {"name": payload.customer_name or existing_cust.get("name"), "type": customer_type}}
            )

    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/orders")
async def list_orders(request: Request, mine: bool = False, limit: int = 200):
    auth = request.headers.get("Authorization", "") if request else ""
    curr = None
    if auth.startswith("Bearer "):
        try:
            p = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALG])
            curr = await db.users.find_one({"id": p["sub"]}, {"_id": 0, "password_hash": 0})
        except Exception:
            curr = None
    query = {}
    if mine:
        if not curr:
            raise HTTPException(status_code=401, detail="Login required")
        query["user_id"] = curr["id"]
    else:
        if not curr or curr.get("role") not in ("owner", "cashier"):
            raise HTTPException(status_code=403, detail="Staff only")
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") not in ("owner", "cashier") and doc.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return doc


@api.patch("/orders/{oid}/status")
async def update_order_status(oid: str, payload: OrderStatusUpdate, _: dict = Depends(require_owner)):
    doc = await db.orders.find_one({"id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {}
    if payload.order_status:
        updates["order_status"] = payload.order_status
    if payload.payment_status:
        updates["payment_status"] = payload.payment_status
    if not updates:
        return {"ok": True}
    history_entry = {"at": now_iso(), **updates}
    await db.orders.update_one({"id": oid}, {"$set": updates, "$push": {"status_history": history_entry}})
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    try:
        await maybe_notify_status_change(doc, payload.order_status, payload.payment_status)
    except Exception as e:
        logger.warning(f"notify failed: {e}")
    return doc


# ---------- settings endpoints ----------
@api.get("/settings")
async def read_settings():
    s = await get_settings()
    return {
        **s,
        "integrations": {
            "twilio": bool(os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_AUTH_TOKEN") and os.environ.get("TWILIO_FROM_NUMBER")),
            "stripe": bool(os.environ.get("STRIPE_API_KEY")),
            "razorpay": bool(os.environ.get("RAZORPAY_KEY_ID") and os.environ.get("RAZORPAY_KEY_SECRET")),
        },
    }


@api.put("/settings")
async def write_settings(payload: SettingsUpdate, _: dict = Depends(require_owner)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.settings.update_one({"id": SETTINGS_ID}, {"$set": updates}, upsert=True)
    return await read_settings()


# ---------- wishlist ----------
@api.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    items = await db.wishlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    result = []
    for w in items:
        p = await db.products.find_one({"id": w["product_id"]}, {"_id": 0})
        if p:
            result.append({"wishlist_id": w["id"], "added_at": w["added_at"], "product": p})
    return result


@api.post("/wishlist")
async def add_wishlist(payload: WishlistItemIn, user: dict = Depends(get_current_user)):
    existing = await db.wishlist.find_one({"user_id": user["id"], "product_id": payload.product_id})
    if existing:
        return {"ok": True, "existed": True}
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "product_id": payload.product_id, "added_at": now_iso()}
    await db.wishlist.insert_one(doc)
    return {"ok": True, "existed": False}


@api.delete("/wishlist/{product_id}")
async def del_wishlist(product_id: str, user: dict = Depends(get_current_user)):
    r = await db.wishlist.delete_one({"user_id": user["id"], "product_id": product_id})
    return {"deleted": r.deleted_count}


# ---------- stats ----------
@api.get("/stats/summary")
async def stats_summary():
    total_products = await db.products.count_documents({})
    total_customers = await db.customers.count_documents({})
    total_supplier = await db.suppliers.count_documents({})
    total_online_order = await db.orders.count_documents({"channel": "ONLINE"})
    
    # Inventory sum of stock quantities
    inv_agg = await db.products.aggregate([
        {"$group": {"_id": None, "total_stock": {"$sum": "$stock"}}}
    ]).to_list(1)
    total_inventory_product = inv_agg[0]["total_stock"] if inv_agg else 0

    # Purchase metrics
    purchase_agg = await db.purchases.aggregate([
        {"$group": {"_id": None, "total_qty": {"$sum": "$closing_qty"}, "total_cost": {"$sum": "$closing_value"}}}
    ]).to_list(1)
    total_purchase_product = purchase_agg[0]["total_qty"] if purchase_agg else 0
    total_purchase_cost = purchase_agg[0]["total_cost"] if purchase_agg else 0

    # Revenue calculation
    rev_agg = await db.orders.aggregate([
        {"$match": {"payment_status": "PAID"}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}}},
    ]).to_list(1)
    total_revenue = rev_agg[0]["revenue"] if rev_agg else 0

    total_profit = total_revenue - total_purchase_cost
    pending = await db.orders.count_documents({"order_status": {"$in": ["PENDING", "CONFIRMED"]}})

    return {
        "total_products": total_products,
        "total_customers": total_customers,
        "total_supplier": total_supplier,
        "total_online_order": total_online_order,
        "total_purchase_product": total_purchase_product,
        "total_inventory_product": round(total_inventory_product, 2),
        "total_revenue": round(total_revenue, 2),
        "total_purchase_cost": round(total_purchase_cost, 2),
        "total_profit": round(total_profit, 2),
        "pending_orders": pending
    }

@api.get("/stats/report")
async def stats_report(_: dict = Depends(require_owner)):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    yesterday_start = today_start - timedelta(days=1)
    tomorrow_start = today_start + timedelta(days=1)

    async def bucket_hourly(start, end):
        docs = await db.orders.find({
            "created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
            "payment_status": "PAID",
        }, {"_id": 0, "created_at": 1, "total": 1}).to_list(5000)
        buckets = [0.0] * 24
        for d in docs:
            try:
                dt = datetime.fromisoformat(d["created_at"])
                buckets[dt.hour] += float(d.get("total", 0))
            except Exception:
                pass
        return buckets

    today = await bucket_hourly(today_start, tomorrow_start)
    yesterday = await bucket_hourly(yesterday_start, today_start)

    top = await db.orders.aggregate([
        {"$match": {"payment_status": "PAID"}},
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "name": {"$first": "$items.name"}, "qty": {"$sum": "$items.quantity"}, "revenue": {"$sum": "$items.subtotal"}}},
        {"$sort": {"revenue": -1}},
        {"$limit": 5},
    ]).to_list(5)

    return {
        "today": today, "yesterday": yesterday,
        "today_total": round(sum(today), 2), "yesterday_total": round(sum(yesterday), 2),
        "top_products": [{"product_id": t["_id"], "name": t["name"], "qty": t["qty"], "revenue": round(t["revenue"], 2)} for t in top],
    }


# ---------- root ----------
@api.get("/")
async def root():
    return {"message": "GS Billing API", "brand": "GS", "built_by": "R I Billing Pro", "pos_name": "GS"}


# 1. முதலில் CORS மிடில்வேரைச் சேர்க்க வேண்டும்
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. அதன் பிறகு ரூட்டரைச் சேர்க்க வேண்டும்
app.include_router(api)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("barcode")
    await db.orders.create_index("created_at")
    
    if await db.customers.count_documents({}) == 0:
        await db.customers.insert_many([
            {"id": str(uuid.uuid4()), "name": "Rahul Kumar", "phone": "9876543210", "email": "rahul@gmail.com", "address": "Chennai", "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "name": "Anitha Raj", "phone": "9123456780", "email": "anitha@gmail.com", "address": "Coimbatore", "created_at": now_iso()}
        ])
    
    if await db.suppliers.count_documents({}) == 0:
        await db.suppliers.insert_many([
            {"id": str(uuid.uuid4()), "name": "Green Farms Ltd", "phone": "9988776655", "email": "support@greenfarms.com", "company": "Green Farms", "address": "Madurai", "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "name": "Apex Distributors", "phone": "9888777666", "email": "sales@apexdist.com", "company": "Apex Corp", "address": "Trichy", "created_at": now_iso()}
        ])

    try:
        from seed_data import PRODUCTS
        existing_barcodes = set(await db.products.distinct("barcode"))
        missing = [p for p in PRODUCTS if p.get("barcode") not in existing_barcodes]
        if missing:
            docs = [Product(**p).model_dump() for p in missing]
            await db.products.insert_many(docs)
    except Exception as e:
        logger.warning(f"Seed skipped: {e}")

    owner_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    owner_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    await db.users.update_many({"role": "admin"}, {"$set": {"role": "owner"}})
    existing = await db.users.find_one({"email": owner_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": owner_email, "password_hash": hash_pw(owner_password),
            "name": "GS Owner", "phone": None, "address": None, "role": "owner", "created_at": now_iso(),
        })
    elif not verify_pw(owner_password, existing["password_hash"]):
        await db.users.update_one({"email": owner_email}, {"$set": {"password_hash": hash_pw(owner_password), "role": "owner"}})
    elif existing.get("role") != "owner":
        await db.users.update_one({"email": owner_email}, {"$set": {"role": "owner"}})


@app.on_event("shutdown")
async def _shutdown():
    client.close()