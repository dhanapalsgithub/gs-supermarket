from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------- Models ----------------
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    price: float
    stock: float = 0
    barcode: Optional[str] = None
    unit: Optional[str] = "pcs"
    image_hint: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    stock: float = 0
    barcode: Optional[str] = None
    unit: Optional[str] = "pcs"
    image_hint: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[float] = None
    barcode: Optional[str] = None
    unit: Optional[str] = None
    image_hint: Optional[str] = None


class SaleItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: float
    subtotal: float


class Sale(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    receipt_no: str
    items: List[SaleItem]
    subtotal: float
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    discount: float = 0.0
    total: float
    payment_method: str
    amount_paid: float = 0.0
    change_due: float = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    cashier: Optional[str] = "Cashier"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SaleCreate(BaseModel):
    items: List[SaleItem]
    subtotal: float
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    discount: float = 0.0
    total: float
    payment_method: str
    amount_paid: float = 0.0
    change_due: float = 0.0
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    cashier: Optional[str] = "Cashier"


# ---------------- Product Endpoints ----------------
@api_router.get("/")
async def root():
    return {"message": "Supermarket POS API"}


@api_router.get("/products", response_model=List[Product])
async def list_products(q: Optional[str] = None, category: Optional[str] = None):
    query = {}
    if category and category != "ALL":
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"barcode": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(2000)
    return [Product(**d) for d in docs]


@api_router.get("/products/barcode/{barcode}")
async def get_by_barcode(barcode: str):
    doc = await db.products.find_one({"barcode": barcode}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**doc)


@api_router.post("/products", response_model=Product)
async def create_product(payload: ProductCreate):
    prod = Product(**payload.model_dump())
    await db.products.insert_one(prod.model_dump())
    return prod


@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, payload: ProductUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.products.update_one({"id": product_id}, {"$set": updates})
    doc = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**doc)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    r = await db.products.delete_one({"id": product_id})
    return {"deleted": r.deleted_count}


@api_router.get("/categories")
async def list_categories():
    cats = await db.products.distinct("category")
    return sorted(cats)


# ---------------- Sale Endpoints ----------------
def _gen_receipt_no() -> str:
    now = datetime.now(timezone.utc)
    return f"RCP-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


@api_router.post("/sales", response_model=Sale)
async def create_sale(payload: SaleCreate):
    sale = Sale(receipt_no=_gen_receipt_no(), **payload.model_dump())
    await db.sales.insert_one(sale.model_dump())
    # decrement stock
    for it in sale.items:
        await db.products.update_one(
            {"id": it.product_id}, {"$inc": {"stock": -it.quantity}}
        )
    return sale


@api_router.get("/sales", response_model=List[Sale])
async def list_sales(limit: int = 100):
    docs = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [Sale(**d) for d in docs]


@api_router.get("/sales/{sale_id}", response_model=Sale)
async def get_sale(sale_id: str):
    doc = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Sale not found")
    return Sale(**doc)


@api_router.get("/stats/summary")
async def stats_summary():
    total_products = await db.products.count_documents({})
    total_sales = await db.sales.count_documents({})
    pipeline = [{"$group": {"_id": None, "revenue": {"$sum": "$total"}}}]
    agg = await db.sales.aggregate(pipeline).to_list(1)
    revenue = agg[0]["revenue"] if agg else 0
    return {
        "total_products": total_products,
        "total_sales": total_sales,
        "total_revenue": round(revenue, 2),
    }


@api_router.post("/seed")
async def seed_products():
    from seed_data import PRODUCTS
    count = await db.products.count_documents({})
    if count > 0:
        return {"seeded": False, "existing": count}
    docs = []
    for p in PRODUCTS:
        prod = Product(**p)
        docs.append(prod.model_dump())
    if docs:
        await db.products.insert_many(docs)
    return {"seeded": True, "count": len(docs)}


app.include_router(api_router)

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
    # Auto-seed on first run
    count = await db.products.count_documents({})
    if count == 0:
        try:
            from seed_data import PRODUCTS
            docs = [Product(**p).model_dump() for p in PRODUCTS]
            if docs:
                await db.products.insert_many(docs)
                logger.info(f"Seeded {len(docs)} products")
        except Exception as e:
            logger.warning(f"Seed skipped: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
