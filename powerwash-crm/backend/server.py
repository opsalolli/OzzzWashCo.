from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os, uuid, logging, jwt, bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'clearview-crm-secret-key-change-in-production-please')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = 30

app = FastAPI(title="ClearView CRM API")
api = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==================== Models ====================
def uid() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    business_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    business_name: Optional[str] = None
    created_at: datetime


class Customer(BaseModel):
    id: str = Field(default_factory=uid)
    user_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: str
    city: Optional[str] = "Dallas"
    state: Optional[str] = "TX"
    zip: Optional[str] = None
    notes: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    service_type: Literal["windows", "powerwashing", "both"] = "both"
    created_at: datetime = Field(default_factory=now)


class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: str
    city: Optional[str] = "Dallas"
    state: Optional[str] = "TX"
    zip: Optional[str] = None
    notes: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    service_type: Optional[str] = "both"


class Staff(BaseModel):
    id: str = Field(default_factory=uid)
    user_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str = "Cleaner"
    active: bool = True
    created_at: datetime = Field(default_factory=now)


class StaffCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str = "Cleaner"


class Job(BaseModel):
    id: str = Field(default_factory=uid)
    user_id: str
    customer_id: str
    customer_name: str
    address: str
    scheduled_at: datetime
    duration_min: int = 60
    status: Literal["scheduled", "in_progress", "completed", "cancelled"] = "scheduled"
    assigned_staff_id: Optional[str] = None
    assigned_staff_name: Optional[str] = None
    price: float = 0.0
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=now)


class JobCreate(BaseModel):
    customer_id: str
    scheduled_at: datetime
    duration_min: int = 60
    assigned_staff_id: Optional[str] = None
    price: float = 0.0
    notes: Optional[str] = ""


class JobUpdate(BaseModel):
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    assigned_staff_id: Optional[str] = None
    price: Optional[float] = None
    notes: Optional[str] = None


class Quote(BaseModel):
    id: str = Field(default_factory=uid)
    user_id: str
    customer_id: str
    customer_name: str
    items: List[dict] = []
    total: float = 0.0
    status: Literal["draft", "sent", "accepted", "rejected"] = "draft"
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=now)


class QuoteCreate(BaseModel):
    customer_id: str
    items: List[dict]
    notes: Optional[str] = ""


class Invoice(BaseModel):
    id: str = Field(default_factory=uid)
    user_id: str
    customer_id: str
    customer_name: str
    customer_email: Optional[str] = None
    invoice_number: str
    items: List[dict] = []
    total: float
    status: Literal["pending", "paid", "overdue", "cancelled"] = "pending"
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now)


class InvoiceCreate(BaseModel):
    customer_id: str
    items: List[dict]
    due_date: Optional[datetime] = None


class House(BaseModel):
    """Dallas canvassing house entry."""
    id: str = Field(default_factory=uid)
    user_id: str
    address: str
    lat: float
    lng: float
    status: Literal["not_knocked", "no_answer", "not_interested", "interested", "customer"] = "not_knocked"
    notes: Optional[str] = ""
    knocked_at: Optional[datetime] = None
    customer_id: Optional[str] = None
    created_at: datetime = Field(default_factory=now)


class HouseCreate(BaseModel):
    address: str
    lat: float
    lng: float
    status: str = "not_knocked"
    notes: Optional[str] = ""


class HouseUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    address: Optional[str] = None


# ==================== Auth Helpers ====================
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def check_password(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


# ==================== Auth Routes ====================
@api.post("/auth/register")
async def register(data: UserRegister):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user = {
        "id": uid(),
        "email": data.email.lower(),
        "password": hash_password(data.password),
        "full_name": data.full_name,
        "business_name": data.business_name or "",
        "created_at": now(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "business_name": user["business_name"],
        },
    }


@api.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or not check_password(data.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")
    token = create_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "business_name": user.get("business_name", ""),
        },
    }


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


# ==================== Customers ====================
@api.get("/customers")
async def list_customers(user=Depends(current_user)):
    items = await db.customers.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api.post("/customers")
async def create_customer(data: CustomerCreate, user=Depends(current_user)):
    c = Customer(user_id=user["id"], **data.model_dump()).model_dump()
    await db.customers.insert_one(c)
    c.pop("_id", None)
    return c


@api.get("/customers/{cid}")
async def get_customer(cid: str, user=Depends(current_user)):
    c = await db.customers.find_one({"id": cid, "user_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Customer not found")
    jobs = await db.jobs.find({"customer_id": cid, "user_id": user["id"]}, {"_id": 0}).sort("scheduled_at", -1).to_list(500)
    invoices = await db.invoices.find({"customer_id": cid, "user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"customer": c, "jobs": jobs, "invoices": invoices}


@api.put("/customers/{cid}")
async def update_customer(cid: str, data: CustomerCreate, user=Depends(current_user)):
    r = await db.customers.update_one({"id": cid, "user_id": user["id"]}, {"$set": data.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Customer not found")
    return {"ok": True}


@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user=Depends(current_user)):
    await db.customers.delete_one({"id": cid, "user_id": user["id"]})
    return {"ok": True}


# ==================== Staff ====================
@api.get("/staff")
async def list_staff(user=Depends(current_user)):
    return await db.staff.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/staff")
async def create_staff(data: StaffCreate, user=Depends(current_user)):
    s = Staff(user_id=user["id"], **data.model_dump()).model_dump()
    await db.staff.insert_one(s)
    s.pop("_id", None)
    return s


@api.delete("/staff/{sid}")
async def delete_staff(sid: str, user=Depends(current_user)):
    await db.staff.delete_one({"id": sid, "user_id": user["id"]})
    return {"ok": True}


# ==================== Jobs ====================
@api.get("/jobs")
async def list_jobs(user=Depends(current_user)):
    return await db.jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("scheduled_at", 1).to_list(1000)


@api.post("/jobs")
async def create_job(data: JobCreate, user=Depends(current_user)):
    cust = await db.customers.find_one({"id": data.customer_id, "user_id": user["id"]}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    staff_name = None
    if data.assigned_staff_id:
        st = await db.staff.find_one({"id": data.assigned_staff_id, "user_id": user["id"]}, {"_id": 0})
        staff_name = st["name"] if st else None
    job = Job(
        user_id=user["id"],
        customer_id=cust["id"],
        customer_name=cust["name"],
        address=cust["address"],
        scheduled_at=data.scheduled_at,
        duration_min=data.duration_min,
        assigned_staff_id=data.assigned_staff_id,
        assigned_staff_name=staff_name,
        price=data.price,
        notes=data.notes or "",
    ).model_dump()
    await db.jobs.insert_one(job)
    job.pop("_id", None)
    return job


@api.put("/jobs/{jid}")
async def update_job(jid: str, data: JobUpdate, user=Depends(current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "assigned_staff_id" in update and update["assigned_staff_id"]:
        st = await db.staff.find_one({"id": update["assigned_staff_id"], "user_id": user["id"]}, {"_id": 0})
        update["assigned_staff_name"] = st["name"] if st else None
    r = await db.jobs.update_one({"id": jid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return {"ok": True}


@api.delete("/jobs/{jid}")
async def delete_job(jid: str, user=Depends(current_user)):
    await db.jobs.delete_one({"id": jid, "user_id": user["id"]})
    return {"ok": True}


# ==================== Quotes ====================
@api.get("/quotes")
async def list_quotes(user=Depends(current_user)):
    return await db.quotes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/quotes")
async def create_quote(data: QuoteCreate, user=Depends(current_user)):
    cust = await db.customers.find_one({"id": data.customer_id, "user_id": user["id"]}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    total = sum(float(i.get("amount", 0)) for i in data.items)
    q = Quote(
        user_id=user["id"], customer_id=cust["id"], customer_name=cust["name"],
        items=data.items, total=total, notes=data.notes or "",
    ).model_dump()
    await db.quotes.insert_one(q)
    q.pop("_id", None)
    return q


@api.post("/quotes/{qid}/convert")
async def convert_quote_to_invoice(qid: str, user=Depends(current_user)):
    q = await db.quotes.find_one({"id": qid, "user_id": user["id"]}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quote not found")
    cust = await db.customers.find_one({"id": q["customer_id"], "user_id": user["id"]}, {"_id": 0})
    inv_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    inv = Invoice(
        user_id=user["id"], customer_id=q["customer_id"], customer_name=q["customer_name"],
        customer_email=(cust or {}).get("email"), invoice_number=inv_number,
        items=q["items"], total=q["total"],
        due_date=now() + timedelta(days=14),
    ).model_dump()
    await db.invoices.insert_one(inv)
    await db.quotes.update_one({"id": qid}, {"$set": {"status": "accepted"}})
    inv.pop("_id", None)
    return inv


# ==================== Invoices ====================
@api.get("/invoices")
async def list_invoices(user=Depends(current_user)):
    items = await db.invoices.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # auto mark overdue (handle naive datetimes from older records)
    cur = now()
    for i in items:
        due = i.get("due_date")
        if i["status"] == "pending" and due:
            if isinstance(due, datetime) and due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            if due < cur:
                i["status"] = "overdue"
    return items


@api.post("/invoices")
async def create_invoice(data: InvoiceCreate, user=Depends(current_user)):
    cust = await db.customers.find_one({"id": data.customer_id, "user_id": user["id"]}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    total = sum(float(i.get("amount", 0)) for i in data.items)
    inv_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    inv = Invoice(
        user_id=user["id"], customer_id=cust["id"], customer_name=cust["name"],
        customer_email=cust.get("email"), invoice_number=inv_number,
        items=data.items, total=total,
        due_date=data.due_date or (now() + timedelta(days=14)),
    ).model_dump()
    await db.invoices.insert_one(inv)
    inv.pop("_id", None)
    return inv


@api.post("/invoices/{iid}/mark-paid")
async def mark_invoice_paid(iid: str, user=Depends(current_user)):
    r = await db.invoices.update_one(
        {"id": iid, "user_id": user["id"]},
        {"$set": {"status": "paid", "paid_at": now()}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Invoice not found")
    return {"ok": True}


@api.post("/invoices/{iid}/pay-stripe")
async def pay_with_stripe(iid: str, user=Depends(current_user)):
    """Create a Stripe PaymentIntent. Requires STRIPE_SECRET_KEY."""
    inv = await db.invoices.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    key = os.environ.get("STRIPE_SECRET_KEY")
    if not key:
        raise HTTPException(400, "Stripe not configured. Set STRIPE_SECRET_KEY in backend/.env")
    try:
        import stripe
        stripe.api_key = key
        intent = stripe.PaymentIntent.create(
            amount=int(round(inv["total"] * 100)),
            currency="usd",
            metadata={"invoice_id": iid, "invoice_number": inv["invoice_number"]},
        )
        return {"client_secret": intent.client_secret, "payment_intent_id": intent.id}
    except Exception as e:
        raise HTTPException(400, f"Stripe error: {str(e)}")


# ==================== Houses (Canvassing Map) ====================
@api.get("/houses")
async def list_houses(user=Depends(current_user)):
    return await db.houses.find({"user_id": user["id"]}, {"_id": 0}).to_list(5000)


@api.post("/houses")
async def create_house(data: HouseCreate, user=Depends(current_user)):
    h = House(user_id=user["id"], **data.model_dump()).model_dump()
    if data.status != "not_knocked":
        h["knocked_at"] = now()
    await db.houses.insert_one(h)
    h.pop("_id", None)
    return h


@api.put("/houses/{hid}")
async def update_house(hid: str, data: HouseUpdate, user=Depends(current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "status" in update and update["status"] != "not_knocked":
        update["knocked_at"] = now()
    r = await db.houses.update_one({"id": hid, "user_id": user["id"]}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "House not found")
    h = await db.houses.find_one({"id": hid}, {"_id": 0})
    return h


@api.delete("/houses/{hid}")
async def delete_house(hid: str, user=Depends(current_user)):
    await db.houses.delete_one({"id": hid, "user_id": user["id"]})
    return {"ok": True}


@api.post("/houses/{hid}/convert-to-customer")
async def convert_house_to_customer(hid: str, user=Depends(current_user)):
    h = await db.houses.find_one({"id": hid, "user_id": user["id"]}, {"_id": 0})
    if not h:
        raise HTTPException(404, "House not found")
    cust = Customer(
        user_id=user["id"], name=h["address"], address=h["address"],
        lat=h["lat"], lng=h["lng"], notes="Converted from canvassing lead"
    ).model_dump()
    await db.customers.insert_one(cust)
    await db.houses.update_one({"id": hid}, {"$set": {"status": "customer", "customer_id": cust["id"]}})
    cust.pop("_id", None)
    return cust


# ==================== Expenses ====================
class Expense(BaseModel):
    id: str = Field(default_factory=uid)
    user_id: str
    title: str
    amount: float
    category: str = "equipment"  # equipment, supplies, vehicle, fuel, other
    vendor: Optional[str] = ""
    notes: Optional[str] = ""
    expense_date: datetime = Field(default_factory=now)
    created_at: datetime = Field(default_factory=now)


class ExpenseCreate(BaseModel):
    title: str
    amount: float
    category: str = "equipment"
    vendor: Optional[str] = ""
    notes: Optional[str] = ""
    expense_date: Optional[datetime] = None


@api.get("/expenses")
async def list_expenses(user=Depends(current_user)):
    return await db.expenses.find({"user_id": user["id"]}, {"_id": 0}).sort("expense_date", -1).to_list(2000)


@api.post("/expenses")
async def create_expense(data: ExpenseCreate, user=Depends(current_user)):
    payload = data.model_dump()
    if not payload.get("expense_date"):
        payload["expense_date"] = now()
    e = Expense(user_id=user["id"], **payload).model_dump()
    await db.expenses.insert_one(e)
    e.pop("_id", None)
    return e


@api.put("/expenses/{eid}")
async def update_expense(eid: str, data: ExpenseCreate, user=Depends(current_user)):
    payload = data.model_dump(exclude_none=True)
    r = await db.expenses.update_one({"id": eid, "user_id": user["id"]}, {"$set": payload})
    if r.matched_count == 0:
        raise HTTPException(404, "Expense not found")
    e = await db.expenses.find_one({"id": eid}, {"_id": 0})
    return e


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user=Depends(current_user)):
    await db.expenses.delete_one({"id": eid, "user_id": user["id"]})
    return {"ok": True}


# ==================== Settings (window pricing, business info) ====================
class Settings(BaseModel):
    user_id: str
    price_small: float = 7.0
    price_medium: float = 12.0
    price_large: float = 20.0
    business_name: Optional[str] = ""
    business_phone: Optional[str] = ""
    business_email: Optional[str] = ""
    business_address: Optional[str] = ""


@api.get("/settings")
async def get_settings(user=Depends(current_user)):
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    if not s:
        s = Settings(user_id=user["id"]).model_dump()
        await db.settings.insert_one(s.copy())
        s.pop("_id", None)
    return s


@api.put("/settings")
async def update_settings(data: dict, user=Depends(current_user)):
    data.pop("user_id", None)
    await db.settings.update_one({"user_id": user["id"]}, {"$set": data}, upsert=True)
    s = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0})
    return s


# ==================== Measurements (Powerwashing area sizing) ====================
class Measurement(BaseModel):
    id: str = Field(default_factory=uid)
    user_id: str
    label: str
    surface_type: str = "driveway"  # driveway, sidewalk, deck, patio, roof, house, fence
    points: List[dict]  # [{lat, lng}, ...]
    area_sqft: float
    perimeter_ft: float = 0.0
    customer_id: Optional[str] = None
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=now)


class MeasurementCreate(BaseModel):
    label: str
    surface_type: str = "driveway"
    points: List[dict]
    area_sqft: float
    perimeter_ft: float = 0.0
    customer_id: Optional[str] = None
    notes: Optional[str] = ""


@api.get("/measurements")
async def list_measurements(user=Depends(current_user)):
    return await db.measurements.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/measurements")
async def create_measurement(data: MeasurementCreate, user=Depends(current_user)):
    m = Measurement(user_id=user["id"], **data.model_dump()).model_dump()
    await db.measurements.insert_one(m)
    m.pop("_id", None)
    return m


@api.delete("/measurements/{mid}")
async def delete_measurement(mid: str, user=Depends(current_user)):
    await db.measurements.delete_one({"id": mid, "user_id": user["id"]})
    return {"ok": True}


# ==================== Dashboard / Stats ====================
# ==================== Next Best Action / Insights ====================
import httpx


async def get_weather_alerts() -> list:
    """Fetch 3-day rain forecast for Dallas via Open-Meteo (no API key)."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as c:
            r = await c.get("https://api.open-meteo.com/v1/forecast",
                            params={"latitude": 32.7767, "longitude": -96.797,
                                    "daily": "precipitation_sum", "timezone": "America/Chicago",
                                    "forecast_days": 4})
        data = r.json().get("daily", {})
        dates = data.get("time", [])
        rain = data.get("precipitation_sum", [])
        return [{"date": dates[i], "rain_mm": float(rain[i] or 0)}
                for i in range(min(len(dates), len(rain)))]
    except Exception:
        return []


@api.get("/insights")
async def insights(user=Depends(current_user)):
    """Rule-based 'Next Best Action' suggestions."""
    out = []
    cur = now()

    # 1) Customers who haven't booked in 45+ days
    customers = await db.customers.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    for c in customers:
        last_job = await db.jobs.find_one(
            {"user_id": user["id"], "customer_id": c["id"], "status": "completed"},
            {"_id": 0}, sort=[("scheduled_at", -1)],
        )
        if last_job:
            last = last_job["scheduled_at"]
            if isinstance(last, datetime) and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            days = (cur - last).days
            if days >= 45:
                out.append({
                    "id": f"reach-{c['id']}", "kind": "reach_out", "icon": "phone-call",
                    "color": "#F97316", "priority": 70 + min(days, 60),
                    "title": f"Text {c['name'].split()[0]}",
                    "body": f"Hasn't booked in {days} days. Last service was a {(last_job.get('customer_name') or 'visit')}.",
                    "cta": "Open customer", "route": f"/customer/{c['id']}", "phone": c.get("phone"),
                })
        else:
            created = c.get("created_at")
            if isinstance(created, datetime) and created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created and (cur - created).days >= 14:
                out.append({
                    "id": f"firstjob-{c['id']}", "kind": "first_booking", "icon": "user-check",
                    "color": "#3B82F6", "priority": 50,
                    "title": f"Book first job for {c['name'].split()[0]}",
                    "body": f"Added {(cur - created).days} days ago, no job yet.",
                    "cta": "Schedule", "route": "/job/new",
                })

    # 2) Upsell — windows-only customers w/ no powerwash yet
    for c in customers:
        if (c.get("service_type") or "both") == "windows":
            out.append({
                "id": f"upsell-{c['id']}", "kind": "upsell", "icon": "trending-up",
                "color": "#22C55E", "priority": 40,
                "title": f"Upsell powerwash to {c['name'].split()[0]}",
                "body": "Windows-only customer — driveway/deck powerwash is an easy add-on.",
                "cta": "Quote it", "route": f"/quote/new",
            })

    # 3) Overdue invoices
    overdue = await db.invoices.find(
        {"user_id": user["id"], "status": {"$in": ["pending", "overdue"]}},
        {"_id": 0},
    ).to_list(500)
    for inv in overdue:
        due = inv.get("due_date")
        if isinstance(due, datetime) and due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if due and due < cur:
            days_late = (cur - due).days
            out.append({
                "id": f"overdue-{inv['id']}", "kind": "collect", "icon": "alert-circle",
                "color": "#EF4444", "priority": 90 + min(days_late, 30),
                "title": f"Collect ${inv['total']:.0f} from {inv['customer_name']}",
                "body": f"Invoice {inv['invoice_number']} is {days_late} days overdue.",
                "cta": "Send reminder", "route": f"/invoice/{inv['id']}",
            })

    # 4) Canvassing follow-ups (interested leads >7 days old)
    houses = await db.houses.find(
        {"user_id": user["id"], "status": "interested"}, {"_id": 0}
    ).to_list(500)
    for h in houses:
        kn = h.get("knocked_at") or h.get("created_at")
        if isinstance(kn, datetime) and kn.tzinfo is None:
            kn = kn.replace(tzinfo=timezone.utc)
        if kn and (cur - kn).days >= 7:
            out.append({
                "id": f"lead-{h['id']}", "kind": "lead_follow_up", "icon": "target",
                "color": "#A855F7", "priority": 60,
                "title": f"Follow up: {h['address']}",
                "body": f"Interested lead from {(cur - kn).days} days ago — strike while warm.",
                "cta": "Open map", "route": "/(tabs)/map",
            })

    # 5) Rain forecast vs scheduled jobs
    forecast = await get_weather_alerts()
    rainy_dates = {f["date"] for f in forecast if f["rain_mm"] >= 5}
    if rainy_dates:
        upcoming = await db.jobs.find(
            {"user_id": user["id"], "status": "scheduled",
             "scheduled_at": {"$gte": cur, "$lte": cur + timedelta(days=4)}}, {"_id": 0}
        ).to_list(500)
        affected = [j for j in upcoming
                    if j["scheduled_at"].strftime("%Y-%m-%d") in rainy_dates]
        if affected:
            day_str = ", ".join(sorted({j["scheduled_at"].strftime("%a %b %d") for j in affected}))
            out.append({
                "id": "rain", "kind": "weather", "icon": "cloud-rain",
                "color": "#0EA5E9", "priority": 85,
                "title": f"Rain coming {day_str}",
                "body": f"{len(affected)} scheduled job(s) may need rescheduling.",
                "cta": "View schedule", "route": "/(tabs)/schedule",
            })

    out.sort(key=lambda x: -x["priority"])
    return {"insights": out[:10]}


@api.get("/revenue/monthly")
async def revenue_monthly(user=Depends(current_user)):
    """Monthly revenue & job count breakdown (sorted newest first).
    Revenue = sum(paid invoices.total) grouped by paid_at month.
    Jobs    = count of jobs grouped by scheduled_at month.
    Returns the union of months that have either revenue or jobs.
    """
    rev_pipeline = [
        {"$match": {"user_id": user["id"], "status": "paid", "paid_at": {"$ne": None}}},
        {"$group": {
            "_id": {"y": {"$year": "$paid_at"}, "m": {"$month": "$paid_at"}},
            "revenue": {"$sum": "$total"},
            "invoices": {"$sum": 1},
        }},
    ]
    job_pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": {"y": {"$year": "$scheduled_at"}, "m": {"$month": "$scheduled_at"}},
            "jobs": {"$sum": 1},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}},
        }},
    ]
    rev_rows = await db.invoices.aggregate(rev_pipeline).to_list(500)
    job_rows = await db.jobs.aggregate(job_pipeline).to_list(500)

    months: dict = {}
    for r in rev_rows:
        k = (r["_id"]["y"], r["_id"]["m"])
        months.setdefault(k, {"revenue": 0.0, "invoices": 0, "jobs": 0, "completed": 0})
        months[k]["revenue"] = float(r.get("revenue", 0))
        months[k]["invoices"] = int(r.get("invoices", 0))
    for r in job_rows:
        k = (r["_id"]["y"], r["_id"]["m"])
        months.setdefault(k, {"revenue": 0.0, "invoices": 0, "jobs": 0, "completed": 0})
        months[k]["jobs"] = int(r.get("jobs", 0))
        months[k]["completed"] = int(r.get("completed", 0))

    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    items = []
    for (y, m), v in months.items():
        items.append({
            "year": y, "month": m,
            "key": f"{y}-{m:02d}",
            "label": f"{month_names[m]} {y}",
            "revenue": round(v["revenue"], 2),
            "invoices": v["invoices"],
            "jobs": v["jobs"],
            "completed": v["completed"],
        })
    items.sort(key=lambda x: (x["year"], x["month"]), reverse=True)

    total_revenue = round(sum(i["revenue"] for i in items), 2)
    total_jobs = sum(i["jobs"] for i in items)
    return {"months": items, "total_revenue": total_revenue, "total_jobs": total_jobs}


@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    jobs_today = await db.jobs.find(
        {"user_id": user["id"], "scheduled_at": {"$gte": today_start, "$lt": today_end}}, {"_id": 0}
    ).sort("scheduled_at", 1).to_list(100)

    # revenue this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    pipeline = [
        {"$match": {"user_id": user["id"], "status": "paid", "paid_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    agg = await db.invoices.aggregate(pipeline).to_list(1)
    revenue_month = agg[0]["total"] if agg else 0.0

    pending_invoices = await db.invoices.count_documents({"user_id": user["id"], "status": {"$in": ["pending", "overdue"]}})
    active_customers = await db.customers.count_documents({"user_id": user["id"]})
    doors_knocked = await db.houses.count_documents({"user_id": user["id"], "status": {"$ne": "not_knocked"}})
    interested_leads = await db.houses.count_documents({"user_id": user["id"], "status": "interested"})
    customers_from_knock = await db.houses.count_documents({"user_id": user["id"], "status": "customer"})
    total_houses = await db.houses.count_documents({"user_id": user["id"]})
    conversion = round((customers_from_knock / total_houses) * 100, 1) if total_houses else 0.0

    return {
        "revenue_month": revenue_month,
        "jobs_today": jobs_today,
        "jobs_today_count": len(jobs_today),
        "pending_invoices": pending_invoices,
        "active_customers": active_customers,
        "doors_knocked": doors_knocked,
        "interested_leads": interested_leads,
        "conversion_rate": conversion,
    }


# ==================== App Setup ====================

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ==================== Stripe Checkout (invoice payments) ====================
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest,
)
from fastapi import Request


class CheckoutRequest(BaseModel):
    invoice_id: str
    origin_url: str


@api.post("/invoices/{iid}/checkout")
async def invoice_checkout(iid: str, body: CheckoutRequest, request: Request, user=Depends(current_user)):
    """Create a Stripe Checkout Session for a specific invoice. Amount is read
    from the database (NEVER trust an amount sent by the client)."""
    inv = await db.invoices.find_one({"id": iid, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv["status"] == "paid":
        raise HTTPException(400, "Invoice already paid")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(500, "Stripe not configured")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/invoice/{iid}"

    metadata = {
        "invoice_id": iid,
        "invoice_number": inv["invoice_number"],
        "user_id": user["id"],
        "customer_name": inv["customer_name"],
    }
    req = CheckoutSessionRequest(
        amount=float(inv["total"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(req)

    # Record the transaction BEFORE redirecting
    tx = {
        "id": uid(),
        "session_id": session.session_id,
        "invoice_id": iid,
        "user_id": user["id"],
        "amount": float(inv["total"]),
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": now(),
        "updated_at": now(),
    }
    await db.payment_transactions.insert_one(tx)

    return {"url": session.url, "session_id": session.session_id}


@api.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    """Poll the status of a checkout session and update the matching invoice
    if payment succeeded. Idempotent — multiple calls won't double-mark."""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(500, "Stripe not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        return {"status": status.status, "payment_status": status.payment_status}

    # Only update if status actually changed (idempotent)
    if tx["payment_status"] != status.payment_status or tx["status"] != status.status:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status.status, "payment_status": status.payment_status, "updated_at": now()}}
        )

    if status.payment_status == "paid":
        # Mark invoice paid only if not already paid
        invoice_id = (tx.get("metadata") or {}).get("invoice_id") or tx.get("invoice_id")
        if invoice_id:
            inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
            if inv and inv["status"] != "paid":
                await db.invoices.update_one(
                    {"id": invoice_id},
                    {"$set": {"status": "paid", "paid_at": now()}}
                )

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        return {"ok": False}
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    try:
        ev = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.warning(f"Stripe webhook error: {e}")
        return {"ok": False}

    if ev.payment_status == "paid":
        invoice_id = (ev.metadata or {}).get("invoice_id")
        if invoice_id:
            inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
            if inv and inv["status"] != "paid":
                await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "paid", "paid_at": now()}})
        await db.payment_transactions.update_one(
            {"session_id": ev.session_id},
            {"$set": {"status": "complete", "payment_status": "paid", "updated_at": now()}}
        )
    return {"ok": True}


# ==================== Code download (no auth, for project export) ====================
from fastapi.responses import FileResponse


@app.get("/api/download/code")
async def download_code():
    path = "/app/powerwash-crm.zip"
    return FileResponse(path, media_type="application/zip", filename="powerwash-crm.zip")


@app.get("/api/download/bundle")
async def download_bundle():
    """Single-file Markdown dump of the entire app source code."""
    path = "/app/CODE_BUNDLE.md"
    return FileResponse(path, media_type="text/markdown", filename="powerwash-crm-source.md")


# Mount the API router AFTER all @api.* routes are defined
app.include_router(api)
