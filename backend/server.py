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
import re
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
        await db.credit_payments.create_index("customer_id")
        await db.credit_payments.create_index("phone")

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

class ClearCreditPayload(BaseModel):
    customer_phone: str
    amount_paid: Optional[float] = None

class PayCreditPayload(BaseModel):
    amount: float
    payment_method: Optional[str] = "CASH"
    phone: Optional[str] = None

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
    unit: Optional[str] = "pcs"

class OrderCreate(BaseModel):
    items: List[SaleItem]
    subtotal: float
    tax_rate: float = 0.05
    tax_amount: float = 0.0
    discount: float = 0.0
    total: float
    payment_method: str
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

@app.get("/")
async def root():
    return {"message": "GS Billing API", "brand": "GS", "built_by": "R I Billing Pro", "status": "active"}

@api.post("/auth/register")
async def register(payload: RegisterInput):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "password_hash": hash_pw(payload.password),
        "name": payload.name, "phone": payload.phone, "address": payload.address,
        "role": "customer",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = make_token(uid, email, "customer")
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
    pm_upper = payload.payment_method.strip().upper()
    is_credit = pm_upper in ("CREDIT", "CREDIT (NON PAY)", "CREDIT_NON_PAY", "CREDIT (NON-PAY)")
    payment_status = "UNPAID" if is_credit else ("PAID" if payload.channel == "POS" or pm_upper in ("UPI", "GPAY") else "UNPAID")

    doc = {
        "id": str(uuid.uuid4()),
        "receipt_no": f"RCP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
        "user_id": user_id,
        **payload.model_dump(),
        "payment_method": pm_upper,
        "order_status": order_status,
        "payment_status": payment_status,
        "status_history": [{"at": now_iso(), "order_status": order_status, "payment_status": payment_status}],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

# FIXED: Filter orders based on user auth when mine=True
@api.get("/orders")
async def list_orders(request: Request, mine: bool = False, limit: int = 200):
    user = None
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        except Exception:
            pass

    query = {}
    if mine:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required to view your orders")
        
        user_id = user.get("id")
        user_phone = user.get("phone")
        user_email = user.get("email")

        or_conditions = [{"user_id": user_id}]
        if user_phone:
            or_conditions.append({"customer_phone": user_phone})
        if user_email:
            or_conditions.append({"customer_email": user_email})

        query = {"$or": or_conditions}

    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)

app.include_router(api)