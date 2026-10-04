from dotenv import load_dotenv
from enum import Enum
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
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

# Logging Setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Database Setup with Timeouts
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=10000,
    connectTimeoutMS=20000,
    socketTimeoutMS=20000
)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
ACCESS_MIN = 60 * 24 * 7  # 7 days

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

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database indexes and default admin user...")
    try:
        await db.users.create_index("email", unique=True)
        await db.products.create_index("barcode")
        await db.orders.create_index("created_at")

        owner_email = os.environ.get("ADMIN_EMAIL", "smallbiz743@gmail.com").lower()
        owner_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
        
        existing = await db.users.find_one({"email": owner_email})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), 
                "email": owner_email, 
                "password_hash": hash_pw(owner_password),
                "name": "GS Owner", 
                "role": "owner", 
                "created_at": now_iso(),
            })
            logger.info(f"Default admin created for {owner_email}")
    except Exception as e:
        logger.error(f"Error during startup database initialization: {e}")
        raise e

    yield

    logger.info("Closing MongoDB connection...")
    client.close()

app = FastAPI(title="CashierPro API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

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

# Pydantic Schemas
class SettingsUpdate(BaseModel):
    sms_enabled: Optional[bool] = None
    payment_gateway: Optional[Literal["SIMULATED", "STRIPE", "RAZORPAY"]] = None
    sms_provider: Optional[str] = None
    
class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    stock: float = 0
    barcode: Optional[str] = None
    unit: Optional[str] = "pcs"
    image_hint: Optional[str] = None

class OfferBroadcastInput(BaseModel):
    message: str

async def send_sms(phone: str, body: str) -> bool:
    if not phone:
        return False
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_num = os.environ.get("TWILIO_FROM_NUMBER")
    if not (sid and token and from_num):
        return False
    to = phone.strip().replace(" ", "").replace("-", "")
    if to and to[0].isdigit() and len(to) == 10:
        to = f"+91{to}"
    elif to and not to.startswith("+"):
        to = f"+{to}"
    try:
        from twilio.rest import Client  # type: ignore
        tw_client = Client(sid, token)
        await asyncio.to_thread(tw_client.messages.create, body=body, from_=from_num, to=to)
        return True
    except Exception:
        return False

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

class PurchaseCreate(BaseModel):
    supplier_name: str
    product_code: str
    product_name: str
    rate: float
    closing_qty: float
    date: str

class SaleItem(BaseModel):
    product_id: Optional[str] = None
    name: str
    price: float
    quantity: float
    subtotal: float

class OrderCreate(BaseModel):
    items: List[SaleItem]
    subtotal: float
    tax_rate: float = 0.05
    tax_amount: float = 0.0
    discount: float = 0.0
    total: float
    payment_method: str  # Allows CASH, UPI, CARD, COD, CREDIT, etc.
    amount_paid: float = 0.0
    change_due: float = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    channel: Literal["POS", "ONLINE"] = "POS"
    cashier: Optional[str] = "Cashier"

class OrderStatusUpdate(BaseModel):
    order_status: Optional[str] = None
    payment_status: Optional[str] = None

class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class WishlistItemIn(BaseModel):
    product_id: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

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

# Root level Endpoints
@app.get("/")
async def root():
    return {"message": "GS Billing API", "brand": "GS", "built_by": "R I Billing Pro", "status": "active"}

# API Router Endpoints
@api.post("/auth/register")
async def register(payload: RegisterInput):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "password_hash": hash_pw(payload.password),
        "name": payload.name, "phone": payload.phone, "address": payload.address,
        "role": "owner",  # default is set to owner for full admin control
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = make_token(uid, email, "owner")
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

@api.get("/customers")
async def list_customers(_: dict = Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    online = []
    walking = []
    for c in customers:
        if "id" not in c:
            c["id"] = str(uuid.uuid4())
        channel_val = str(c.get("channel", "")).upper()
        type_val = str(c.get("type", "")).upper()
        if channel_val == "ONLINE" or type_val == "ONLINE":
            online.append(c)
        else:
            walking.append(c)
    return {"online": online, "walking": walking}

@api.post("/customers")
async def create_customer(payload: CustomerCreate, _: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "type": "POS",
        "channel": "POS",
        "created_at": now_iso()
    }
    await db.customers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/suppliers")
async def list_suppliers(_: dict = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    for s in suppliers:
        if "id" not in s:
            s["id"] = str(uuid.uuid4())
    return suppliers

@api.post("/suppliers")
async def create_supplier(payload: SupplierCreate, _: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "created_at": now_iso()}
    await db.suppliers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.put("/products/{pid}")
async def update_product(pid: str, payload: ProductCreate, _: dict = Depends(get_current_user)):
    updates = payload.model_dump()
    r = await db.products.update_one({"id": pid}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return await db.products.find_one({"id": pid}, {"_id": 0})

@api.get("/products")
async def list_products(q: Optional[str] = None, category: Optional[str] = None):
    query = {}
    if category and category != "ALL":
        query["category"] = category
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"barcode": {"$regex": q, "$options": "i"}}]
    return await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(2000)

@api.post("/products")
async def create_product(payload: ProductCreate, _: dict = Depends(get_current_user)):
    prod = Product(**payload.model_dump())
    await db.products.insert_one(prod.model_dump())
    return prod

@api.delete("/products/{pid}")
async def delete_product(pid: str, _: dict = Depends(get_current_user)):
    r = await db.products.delete_one({"id": pid})
    return {"deleted": r.deleted_count}

@api.get("/categories")
async def list_categories():
    return sorted(await db.products.distinct("category"))

@api.post("/admin/broadcast-offer")
async def broadcast_offer(payload: OfferBroadcastInput, _: dict = Depends(get_current_user)):
    offer_doc = {"id": str(uuid.uuid4()), "message": payload.message, "created_at": now_iso()}
    await db.offers.insert_one(offer_doc)
    online_customers = await db.customers.find({"$or": [{"type": "ONLINE"}, {"channel": "ONLINE"}]}, {"_id": 0, "phone": 1}).to_list(5000)
    sent_count = 0
    for c in online_customers:
        if c.get("phone") and await send_sms(c["phone"], payload.message):
            sent_count += 1
    return {"success": True, "total_targeted": len(online_customers), "sent": sent_count}

@api.get("/offers/active")
async def get_active_offers():
    return await db.offers.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)

@api.get("/purchases")
async def list_purchases(_: dict = Depends(get_current_user)):
    return await db.purchases.find({}, {"_id": 0}).to_list(2000)

@api.post("/purchases")
async def create_purchase(payload: PurchaseCreate, _: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), **payload.model_dump(), "closing_value": payload.rate * payload.closing_qty, "created_at": now_iso()}
    await db.purchases.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

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

    order_status = "CONFIRMED" if payload.channel == "POS" else "PENDING"
    
    # Normalize payment method for comparison
    pm_upper = payload.payment_method.strip().upper()
    is_credit = pm_upper in ("CREDIT", "CREDIT (NON PAY)", "CREDIT_NON_PAY", "CREDIT (NON-PAY)")
    
    payment_status = "UNPAID" if is_credit else ("PAID" if payload.channel == "POS" or pm_upper in ("UPI", "GPAY") else "UNPAID")

    doc = {
        "id": str(uuid.uuid4()),
        "receipt_no": gen_receipt_no(),
        "user_id": user_id,
        **payload.model_dump(),
        "payment_method": pm_upper,
        "order_status": order_status,
        "payment_status": payment_status,
        "status_history": [{"at": now_iso(), "order_status": order_status, "payment_status": payment_status}],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(doc)

    if payload.customer_phone:
        phone_clean = payload.customer_phone.strip()
        credit_add = float(payload.total) if is_credit else 0.0
        
        existing_cust = await db.customers.find_one({"phone": phone_clean})
        if existing_cust:
            current_bal = float(existing_cust.get("credit_balance", 0.0))
            new_bal = current_bal + credit_add
            await db.customers.update_one(
                {"phone": phone_clean},
                {
                    "$set": {
                        "name": payload.customer_name or existing_cust.get("name", "Customer"),
                        "credit_balance": new_bal,
                        "updated_at": now_iso()
                    }
                }
            )
        else:
            cust_doc = {
                "id": str(uuid.uuid4()),
                "name": payload.customer_name or "Customer",
                "phone": phone_clean,
                "type": payload.channel,
                "channel": payload.channel,
                "credit_balance": credit_add,
                "created_at": now_iso(),
                "updated_at": now_iso()
            }
            await db.customers.insert_one(cust_doc)

    for it in payload.items:
        if it.product_id:
            await db.products.update_one({"id": it.product_id}, {"$inc": {"stock": -it.quantity}})
        
    return {k: v for k, v in doc.items() if k != "_id"}

@api.put("/orders/{oid}")
@api.patch("/orders/{oid}/status")
@api.put("/orders/{oid}/status")
async def update_order_status(oid: str, payload: OrderStatusUpdate, _: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    # ID அல்லது receipt_no இரண்டிலும் தேடுதல்
    order = await db.orders.find_one({"$or": [{"id": oid}, {"receipt_no": oid}]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    real_id = order["id"]
    new_order_status = updates.get("order_status", order.get("order_status"))
    new_pay_status = updates.get("payment_status", order.get("payment_status"))

    status_entry = {"at": now_iso(), "order_status": new_order_status, "payment_status": new_pay_status}

    result = await db.orders.update_one(
        {"id": real_id},
        {
            "$set": updates,
            "$push": {"status_history": status_entry}
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order update failed")

    return await db.orders.find_one({"id": real_id}, {"_id": 0})

@api.get("/settings")
async def read_settings():
    return await get_settings()

@api.put("/settings")
async def write_settings(payload: SettingsUpdate, _: dict = Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.settings.update_one({"id": SETTINGS_ID}, {"$set": updates}, upsert=True)
    return await read_settings()

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

@api.get("/stats/summary")
async def stats_summary():
    return {
        "total_products": await db.products.count_documents({}),
        "total_customers": await db.customers.count_documents({}),
        "total_supplier": await db.suppliers.count_documents({}),
        "total_online_order": await db.orders.count_documents({"channel": "ONLINE"}),
        "pending_orders": await db.orders.count_documents({"order_status": {"$in": ["PENDING", "CONFIRMED"]}})
    }

# Include API Router
app.include_router(api)