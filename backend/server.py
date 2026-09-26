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


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ---------- settings / integrations ----------
SETTINGS_ID = "app_settings"
DEFAULT_SETTINGS = {
    "id": SETTINGS_ID,
    "sms_enabled": False,
    "payment_gateway": "SIMULATED",  # SIMULATED | STRIPE | RAZORPAY
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


async def send_sms(phone: str, body: str) -> bool:
    """Fire-and-forget SMS via Twilio; graceful when keys missing."""
    if not phone:
        return False
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = os.environ.get("TWILIO_FROM_NUMBER")
    if not (sid and token and from_num):
        logger.info(f"[SMS skipped - Twilio keys missing] → {phone}: {body}")
        return False

    # normalize Indian 10-digit numbers
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
async def create_product(payload: ProductCreate, _: dict = Depends(require_admin)):
    prod = Product(**payload.model_dump())
    await db.products.insert_one(prod.model_dump())
    return prod


@api.put("/products/{pid}")
async def update_product(pid: str, payload: ProductUpdate, _: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.products.update_one({"id": pid}, {"$set": updates})
    doc = await db.products.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return doc


@api.delete("/products/{pid}")
async def delete_product(pid: str, _: dict = Depends(require_admin)):
    r = await db.products.delete_one({"id": pid})
    return {"deleted": r.deleted_count}


@api.get("/categories")
async def list_categories():
    return sorted(await db.products.distinct("category"))


@api.post("/products/import")
async def import_products(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    """Import CSV with columns: name, category, price, stock, barcode, unit"""
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


# ---------- orders (unified with sales) ----------
def gen_receipt_no():
    return f"RCP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


@api.post("/orders")
async def create_order(payload: OrderCreate, request: Request):
    """Create order. Auth optional - anonymous walk-in sales allowed."""
    user_id = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            p = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALG])
            user_id = p["sub"]
        except Exception:
            pass

    channel = payload.channel
    # Order flow:
    #  POS: paid immediately, status CONFIRMED
    #  ONLINE with COD: unpaid until delivery, status PENDING
    #  ONLINE with UPI: paid on QR confirm, status CONFIRMED
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
    # decrement stock
    for it in payload.items:
        await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.quantity}})
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/orders")
async def list_orders(request: Request, mine: bool = False, limit: int = 200):
    # try current user
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
        if not curr or curr.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
    docs = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and doc.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return doc


@api.patch("/orders/{oid}/status")
async def update_order_status(oid: str, payload: OrderStatusUpdate, _: dict = Depends(require_admin)):
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
    # SMS notification (fire & forget)
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
async def write_settings(payload: SettingsUpdate, _: dict = Depends(require_admin)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.settings.update_one({"id": SETTINGS_ID}, {"$set": updates}, upsert=True)
    return await read_settings()


# ---------- wishlist ----------
@api.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    items = await db.wishlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    # attach product info
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
    total_orders = await db.orders.count_documents({})
    agg = await db.orders.aggregate([
        {"$match": {"payment_status": "PAID"}},
        {"$group": {"_id": None, "revenue": {"$sum": "$total"}}},
    ]).to_list(1)
    revenue = agg[0]["revenue"] if agg else 0
    pending = await db.orders.count_documents({"order_status": {"$in": ["PENDING", "CONFIRMED"]}})
    return {"total_products": total_products, "total_orders": total_orders, "total_revenue": round(revenue, 2), "pending_orders": pending}


@api.get("/stats/report")
async def stats_report(_: dict = Depends(require_admin)):
    """Today vs yesterday hourly + top 5 selling products"""
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

    # top 5 products (all-time paid)
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


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _startup():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("barcode")
    await db.orders.create_index("created_at")
    # seed products
    if await db.products.count_documents({}) == 0:
        try:
            from seed_data import PRODUCTS
            docs = [Product(**p).model_dump() for p in PRODUCTS]
            if docs:
                await db.products.insert_many(docs)
                logger.info(f"Seeded {len(docs)} products")
        except Exception as e:
            logger.warning(f"Seed skipped: {e}")
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email, "password_hash": hash_pw(admin_password),
            "name": "Admin", "phone": None, "address": None, "role": "admin", "created_at": now_iso(),
        })
        logger.info(f"Seeded admin {admin_email}")
    elif not verify_pw(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_pw(admin_password), "role": "admin"}})
        logger.info("Admin password refreshed")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
