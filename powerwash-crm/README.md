# PowerWash CRM

A full-stack mobile CRM for window cleaning & powerwashing businesses. Built with **Expo (React Native)** + **FastAPI** + **MongoDB**.

## Features

- 📊 **Dashboard** with revenue, jobs today, pending invoices, customers, doors knocked, expenses
- 💰 **Monthly Revenue** drill-down sortable by month / number of jobs / top revenue
- 🧠 **Next Best Action AI** — rule-based engine suggesting follow-ups, upsells, overdue collections, weather alerts
- 🗺️ **Interactive Dallas Map** (Leaflet + Google satellite tiles) for door-knocking with status pins (Customer / Interested / Not Interested / No Answer / Not Knocked)
- 📐 **Polygon Area Measurement** — equirectangular shoelace formula for accurate sqft of driveways, patios, etc.
- 👥 **Customers** with service-type tags (Windows / Powerwashing / Both), call/SMS/email actions, delete
- 🧾 **Quotes → Invoices** conversion flow
- 💳 **Stripe Checkout** integration for invoice payments
- 📅 **Jobs scheduling** with staff assignment
- 💸 **Expense tracking** by category
- 🧮 **Window Pricing Calculator** (small / medium / large)
- 📦 **Source code export** endpoint (zip + single-file markdown)

## Stack

| Layer | Tech |
|------|------|
| Mobile | Expo Router (file-based routing), React Native, react-native-webview, react-native-reanimated |
| Backend | FastAPI, Motor (async MongoDB), Pydantic, PyJWT, bcrypt |
| Database | MongoDB |
| Payments | Stripe (via emergentintegrations) |
| Maps | Leaflet inside WebView, Google Hybrid tiles |

## Project structure

```
.
├── backend/
│   ├── server.py          # All API routes in one file
│   ├── requirements.txt
│   └── .env               # MONGO_URL, DB_NAME, STRIPE_API_KEY, JWT_SECRET
├── frontend/
│   ├── app/               # Expo Router screens (file-based routing)
│   │   ├── (tabs)/        # Tab nav: dashboard, map, customers, schedule
│   │   ├── customer/      # [id], new
│   │   ├── invoice/       # [id], new
│   │   ├── quote/new
│   │   ├── job/new
│   │   ├── invoices/, quotes/, staff/, expenses/
│   │   ├── revenue.tsx    # Monthly revenue breakdown
│   │   ├── calculator.tsx
│   │   ├── settings.tsx
│   │   └── payment-success.tsx
│   ├── src/
│   │   ├── auth.tsx       # Auto-login auth context
│   │   └── theme.ts       # Design tokens (white/blue theme)
│   ├── package.json
│   └── app.json
└── README.md
```

## Setup

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=powerwash_crm
JWT_SECRET=change-me-in-production
STRIPE_API_KEY=sk_test_...     # optional, only for invoice payments
```

Run:

```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend (Expo)

```bash
cd frontend
yarn install                  # or npm install
```

Create `frontend/.env`:

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

Run:

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `w` for web.

## API endpoints (selected)

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/dashboard` | Aggregated home metrics |
| GET    | `/api/insights`  | Next Best Action suggestions |
| GET    | `/api/revenue/monthly` | Revenue + job counts grouped by month |
| GET/POST/PUT/DELETE | `/api/customers[/:id]` | Customer CRUD |
| GET/POST/PUT/DELETE | `/api/houses[/:id]`    | Canvassing pin CRUD |
| GET/POST | `/api/measurements` | Polygon area measurements |
| GET/POST | `/api/quotes`, `/api/jobs`, `/api/invoices`, `/api/expenses` | CRUD |
| POST | `/api/invoices/:id/checkout` | Create Stripe Checkout session |
| GET  | `/api/checkout/status/:session_id` | Poll payment status |
| POST | `/api/webhook/stripe` | Stripe webhook |

## License

MIT — go build a great window-cleaning empire.
