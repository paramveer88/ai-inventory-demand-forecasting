One-Line Description (for project header)

Full-stack ERP system with an integrated ML forecasting pipeline that predicts 30-day product demand using historical sales trends and generates automated inventory reorder recommendations.


----

Bullet Points (pick the ones most relevant to the role you're applying for)

Architecture & Backend

Designed a decoupled 3-service architecture — React SPA, Node.js/Express REST API, and a Python FastAPI ML microservice — communicating over HTTP with clean separation of concerns
Built 15+ RESTful API endpoints in Express/TypeScript covering full CRUD for products, vendors, orders, inventory, and forecasting, following an MVC pattern (Controllers → Services → Repositories)
Used Prisma ORM with MongoDB Atlas for type-safe database access across 8 relational collections including products, orders, inventory, vendors, and forecast run records
Implemented atomic order processing using Prisma's $transaction to simultaneously log orders and decrement inventory stock, preventing data drift under concurrent load
Engineered a background cron worker (node-cron) that auto-generates random orders every 5 minutes and new products every hour to simulate live business activity


Machine Learning & Forecasting

Built a Linear Regression demand forecasting pipeline using Python (FastAPI + scikit-learn + pandas) that trains on 60-day sales time-series data and predicts the next 30 days of demand per product
Implemented automated data preprocessing on the backend: UTC-normalized date aggregation, zero-filling for missing calendar days, and a minimum-history fallback (< 5 active days → default 5 units/day) to prevent model training errors
Designed a 1-hour forecast caching layer in the database (ForecastRun model) to prevent redundant ML service calls and reduce API latency
Calculated inventory reorder thresholds from ML output using supply chain formulas: Reorder Level = (Avg Daily Demand × Lead Time) + Safety Stock; Days Until Stockout = Current Stock / Avg Daily Demand


Frontend & Data Visualization

Developed a multi-page React 19 + TypeScript SPA (Vite + TailwindCSS) with a dark-themed dashboard displaying live KPI metrics, demand charts, and AI-driven alerts
Integrated Recharts to render a dual-line Strategic Demand Timeline chart overlaying actual historical sales (past 14 days) against AI-predicted demand (next 15 days)
Built a full product management interface with real-time search, category filtering, pagination, and modal-based CRUD — plus CSV/Excel bulk import and export functionality using multer


Data Engineering & Simulation

Built a high-fidelity business data simulator generating 120 days of synthetic orders with realistic seasonality: weekend boost (×1.3), December holiday surge (×1.8), category-based base demand, upward growth trend, and ±10% random noise


Tech Stack Line (for skills section or project footer)

React 19 · TypeScript · Node.js · Express.js · Prisma ORM · MongoDB Atlas · Python · FastAPI · scikit-learn · pandas · Recharts · TailwindCSS · Vite · REST API · node-cron



---

# SmartERP AI — Full Project Review

## 🧭 What Is This Project?

**SmartERP AI** is a full-stack, AI-powered **Inventory & Demand Forecasting System**. Think of it as a smart brain for a warehouse or retail store. It tracks stock, processes orders, predicts future sales using Machine Learning, and alerts you when items are running low — all automatically.

---

## 🏛️ Architecture Overview

The project is split into **3 independent services** that talk to each other over HTTP:

```
┌──────────────────────────────────────────────────────┐
│             User's Browser (React SPA)               │
│  Dashboard | Products | Inventory | Orders           │
└────────────────────┬─────────────────────────────────┘
                     │  HTTP (Axios / VITE_API_URL)
                     ▼
┌──────────────────────────────────────────────────────┐
│     Node.js / Express Backend  (port 5000)           │
│  Controllers → Services → Prisma ORM → MongoDB       │
│  + node-cron background workers                      │
└────────────┬──────────────────────────┬──────────────┘
             │ Prisma/MongoDB Atlas     │ HTTP POST /ml/forecast
             ▼                         ▼
   ┌──────────────────┐    ┌───────────────────────────┐
   │  MongoDB Atlas   │    │  FastAPI ML Service        │
   │  (Cloud DB)      │    │  (Python / port 8000)      │
   │                  │    │  scikit-learn LinearRegr.  │
   └──────────────────┘    └───────────────────────────┘
```

| Layer | Tech | Port | Role |
|---|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite + TailwindCSS | 5173 | UI Dashboard |
| **Backend** | Node.js + Express + TypeScript + Prisma | 5000 | API & Business Logic |
| **ML Service** | Python + FastAPI + scikit-learn | 8000 | Demand Forecasting |
| **Database** | MongoDB Atlas (cloud) | N/A | Persistent Data Store |

---

## 📁 Directory Structure

```
GUA_1/
├── frontend/          # React SPA
│   └── src/
│       ├── App.tsx            # Root layout + sidebar nav
│       ├── api.ts             # All Axios API calls (typed)
│       ├── ThemeContext.tsx    # Dark/Light mode toggle
│       └── components/
│           ├── Dashboard.tsx  # Main charts + KPI cards
│           ├── Products.tsx   # Product CRUD + CSV import/export
│           ├── Inventory.tsx  # Stock health + AI reorder cards
│           ├── Orders.tsx     # Order log viewer
│           └── Vendors.tsx    # Vendor management
│
├── backend/           # Express API
│   ├── prisma/schema.prisma   # MongoDB data models
│   └── src/
│       ├── routes/index.ts    # All route registrations
│       ├── controllers/       # HTTP request handlers
│       └── services/
│           ├── inventory.service.ts   # ML pipeline orchestrator
│           ├── simulation.service.ts  # Bulk data generator
│           ├── cron.service.ts        # Automated background jobs
│           ├── order.service.ts       # Transactional order logic
│           ├── product.service.ts     # Product CRUD
│           ├── vendor.service.ts      # Vendor CRUD
│           └── import-export.service.ts # CSV/Excel bulk ops
│
└── ml-service/        # Python FastAPI
    └── app.py         # Linear Regression forecast endpoint
```

---

## 🗄️ Database Schema (MongoDB via Prisma)

7 collections, all stored in MongoDB Atlas:

```
Product ──────┬──── OrderItem ──── Order
              ├──── Inventory      (1:1 per product)
              ├──── ProductVendor ─ Vendor
              ├──── ForecastRun ──┬── Forecast
              └──── Forecast       (individual day predictions)
```

| Collection | Key Fields | Purpose |
|---|---|---|
| `Product` | name, category | Catalog items |
| `Inventory` | currentStock, reorderLevel, safetyStock, leadTime | Stock levels |
| `Order` | date, totalAmount | Transaction header |
| `OrderItem` | productId, orderId, quantity | Line items per order |
| `Vendor` | name, contactEmail | Supplier profiles |
| `ProductVendor` | productId, vendorId, price | Pricing agreements |
| `ForecastRun` | productId, modelVersion, createdAt | ML run metadata |
| `Forecast` | productId, forecastRunId, date, predictedDemand | Daily AI predictions |

---

## ⚙️ Backend API Routes

All prefixed under `/api`:

| Method | Route | What it does |
|---|---|---|
| GET | `/products` | Paginated, searchable, filterable product list |
| GET | `/products/:id` | Single product with inventory + vendors |
| POST | `/products` | Create product + initialize inventory |
| PUT | `/products/:id` | Update product + rebuild vendor pricing |
| DELETE | `/products/:id` | Delete (blocked if active orders exist) |
| POST | `/products/import` | Bulk import via CSV/Excel upload |
| GET | `/products/export` | Stream catalog as CSV download |
| GET | `/products/sample-file` | Download a CSV template |
| GET | `/vendors` | All vendors |
| POST/PUT/DELETE | `/vendors/:id` | Vendor CRUD |
| GET | `/orders` | Paginated order log |
| POST | `/orders` | Create order (decrements stock atomically) |
| GET | `/inventory` | All inventory items with product + vendor data |
| GET | `/forecast?productId=` | Run or fetch ML forecast for a product |
| GET | `/forecast/history?productId=` | Past forecast accuracy data |
| GET | `/forecast/seed-history?days=` | DEV: Insert backdated forecast runs |
| GET | `/recommendations?productId=` | AI-calculated reorder stats |
| POST | `/simulate-data` | Generate 120 days of fake historical data |

---

## 🔁 Core Data Flows

### 1. Order Creation Flow
```
User clicks "Place Order" (Orders page)
    → POST /orders { items: [{productId, quantity}] }
    → OrderService.createOrder()
    → prisma.$transaction()
        → tx.order.create()       // log the order
        → tx.inventory.update()   // decrement currentStock atomically
    → Returns order with items
```

### 2. AI Forecast Flow (the "brain")
```
User opens Dashboard or Inventory
    → GET /forecast?productId=XYZ
    → InventoryService.generateForecast(productId)
        ① Anti-spam: Check if run < 1 hour old → reuse if yes
        ② Fetch 60 days of OrderItems from DB
        ③ Aggregate by day (UTC) + zero-fill missing days
        ④ If < 5 days of real sales → use fallback (5.0 units/day)
        ⑤ POST to FastAPI /ml/forecast with salesData[]
    → ML Service (Python):
        - Builds DataFrame, sorts by date
        - Creates day_index (0..59)
        - Trains LinearRegression(X=day_index, y=quantity)
        - Predicts next 30 days (index 60..89)
        - Clips negatives to 0
        - Returns {next_30_days, daily_predictions[], trend}
    → Backend:
        ⑥ Saves ForecastRun + Forecast records to DB
        ⑦ calculateRecommendations():
            avgDailyDemand = sum(predictions) / 30
            reorderLevel   = avgDailyDemand × leadTime + safetyStock
            recommendedStock = reorderLevel + avgDailyDemand × 7
            daysUntilStockout = currentStock / avgDailyDemand
        ⑧ Updates inventory.reorderLevel in DB
    → Frontend: renders blue line (actual) + green dashed line (predicted)
```

### 3. Simulation Flow
```
User clicks "RUN SIMULATION"
    → POST /simulate-data
    → SimulationService.simulateData()
        ① Clear all OrderItems, Orders, Forecasts
        ② Ensure at least 1 vendor and 3 default products exist
        ③ Loop 120 days backward from today:
            - Weekend: quantity × 1.3
            - December: quantity × 1.8
            - Electronics: base qty = 5, others = 2
            - Trend: × (1 + day/500)  [slight upward trend]
            - Noise: × (0.9 to 1.1)  [±10% random]
            - Create 1 Order per product per day
    → Returns { days: 120, productsCached: N }
    → Frontend: refetches all data and re-renders charts
```

### 4. Cron Background Workers (auto-running if `ENABLE_CRON=true`)
```
Every 5 minutes:
    → Pick random product
    → Create an order (qty: 1–5 units)
    → Decrement inventory automatically

Every 1 hour:
    → Generate a new random product (name + category)
    → Assign to existing vendor
    → Initial stock: 100–1000 units
```

---

## 🖥️ Frontend Pages

### Dashboard (`Dashboard.tsx`)
The command center. On load, it:
1. Fetches all inventory items
2. For each product, **in parallel** fetches: recommendations, forecast, forecast history
3. Builds the **Strategic Demand Timeline** chart:
   - Looks back 14 days (actual sales = blue solid line)
   - Looks forward 15 days (AI predictions = green dashed line)
   - Past predicted lines come from historical `ForecastRun` records
4. Builds the **Stock vs Strategy** bar chart (current stock vs reorder level)
5. Shows **Logistics Control Unit** — red alert cards for items below reorder level
6. Shows 4 KPI stat cards (total stock, SKU count, critical alerts, AI confidence)
7. Two action buttons: **RUN SIMULATION** and **SEED HISTORY** (dev tool)

### Products (`Products.tsx`)
Full product catalog management:
- Searchable, filterable, sortable table (paginated, 10 per page)
- **Create**: Opens modal → name, category, initial stock, vendor pricing
- **Edit**: Opens pre-filled modal → update name/category/vendors
- **Delete**: Guarded by backend (blocked if orders exist)
- **Import**: Upload CSV/Excel → bulk create products
- **Export**: Download entire catalog as CSV
- **Sample CSV**: Download a blank template

### Inventory (`Inventory.tsx`)
Per-product inventory health cards showing:
- Current Stock (red if below reorder level)
- Reorder Level (AI-calculated, yellow)
- Recommended Stock (green)
- Days Until Stockout (purple)
- AI recommendation panel with "Generate Purchase Order" button (UI only)

### Orders (`Orders.tsx`)
- Paginated table of all historical orders
- Shows date, total amount, and which products were ordered

### Vendors (`Vendors.tsx`)
- Vendor CRUD: create, edit, delete
- Shows how many products each vendor is linked to

---

## 🧠 ML Service Details (`ml-service/app.py`)

Two endpoints:
- `GET /health` — Simple health check
- `POST /ml/forecast` — The core engine

**Algorithm:**
1. Receives `{ productId, salesData: [{date, quantity}] }`
2. Converts to pandas DataFrame, sorts by date
3. Creates a sequential `day_index` column (0, 1, 2, ... 59)
4. Trains `sklearn.LinearRegression(X=day_index, y=quantity)`
5. Predicts days 60–89 (next 30 days)
6. Clips all predictions to `max(0, value)`
7. Returns:
   - `next_30_days`: total predicted units
   - `daily_predictions`: `[{date, value}]` for charting
   - `trend`: `"increasing"` or `"decreasing"` based on slope coefficient

> [!NOTE]
> The ML model is **stateless** — it retrains on every request. The backend handles caching via the 1-hour `ForecastRun` anti-spam check.

---

## 🔑 Key Design Decisions

| Decision | Why |
|---|---|
| **MongoDB** (not SQLite as README says) | Flexible schema, cloud-hosted via Atlas |
| **Prisma ORM** | Type-safe DB queries, easy schema migrations |
| **Stateless ML service** | Simple to deploy, no model persistence needed |
| **1-hour forecast cache** | Prevents hammering the ML service on every page load |
| **Prisma `$transaction`** for orders | Prevents stock drift in concurrent scenarios |
| **Zero-fill time series** | Ensures the regression model sees continuous time data |
| **Fallback forecast (5.0 units/day)** | Prevents ML errors when there's insufficient sales history |

---

## 🚀 How to Run All 3 Services

```bash
# 1. ML Service (Python)
cd ml-service
source venv/bin/activate
python app.py          # runs on port 8000

# 2. Backend (Node.js)
cd backend
npm install
npx prisma generate
npm run dev            # runs on port 5000

# 3. Frontend (React)
cd frontend
pnpm install
pnpm run dev           # runs on port 5173
```

> [!IMPORTANT]
> The frontend dev server is already running (`pnpm run dev` in `/frontend`).
> The correct command is `pnpm run dev`, NOT `pnpm rundev`.

---

## 📊 Data Relationships Summary

```
Vendor ←── ProductVendor ──→ Product ──→ Inventory
                                  │
                                  ├──→ OrderItem ──→ Order
                                  │
                                  ├──→ ForecastRun ──→ Forecast
                                  └──→ Forecast
```
