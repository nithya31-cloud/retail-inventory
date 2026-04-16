# Retail Inventory Insights

Production-grade Inventory Management & Data Analysis Platform.
All currency values are in Indian Rupees (₹ INR).

## Real Data Used

This project uses REAL data from three official sources:

| Source | Data | Records |
|--------|------|---------|
| US Bureau of Labor Statistics | Monthly retail trade employment signal (2006–2015) | 120 months |
| US Federal Reserve (statsmodels) | CPI / inflation data for price calibration | 51 years |
| NOAA / NWS | Seattle historical weather for seasonality | 1,461 days |
| Amazon.in / Flipkart verified | 50 real Indian products with actual MRP prices | 50 products |

**Result: 66,206 sales transactions · ₹21.7 Crore total revenue · 10-year date range**

## Quick Start (3 terminals in VS Code)

### Step 1 — Database
```bash
mysql -u root -p < database/schema.sql
```

### Step 2 — Python (run ONCE, data already included)
```bash
cd python-analytics
pip install -r requirements.txt
python analytics_engine.py
```
Data is already pre-generated. This just re-runs analytics if needed.

### Step 3 — Backend (Terminal 1)
```bash
cd backend
cp .env.example .env
# Edit .env: set DB_PASSWORD and JWT_SECRET
npm install
npm run dev
```
Verify: open http://localhost:5000/api/health

### Step 4 — Seed the database (run once)
```bash
cd backend
node src/utils/seeder.js
```

### Step 5 — Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

### Login
- URL: http://localhost:3000
- Email: admin@retailinsights.in  
- Password: Admin@1234

## Features

- Dashboard — KPIs (₹21.7 Cr revenue, inventory value, low stock count), sales trend charts, top products, restock alerts
- Inventory — Full CRUD with search, filter by ABC class / stock status / category
- Analytics — ABC Analysis (Pareto), Stock Classification (Fast/Slow/Dead), Days of Supply, Demand Heatmap
- Forecasting — Polynomial Linear Regression, 30-day predictions with confidence bands
- Alerts — Auto-generated low stock / overstock alerts
- Import/Export — Upload CSV, download PDF reports, export CSV

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Backend | Node.js + Express.js |
| Database | MySQL 8 |
| Auth | JWT + bcryptjs |
| Analytics | Python + Pandas + NumPy + Scikit-learn |
| Export | PDFKit |

## API Endpoints

### Auth
- POST /api/auth/login
- GET  /api/auth/profile

### Products  
- GET    /api/products?search=&category_id=&abc_class=&stock_status=&page=&limit=
- POST   /api/products
- PUT    /api/products/:id
- DELETE /api/products/:id

### Analytics
- GET  /api/analytics/kpis
- GET  /api/analytics/abc
- GET  /api/analytics/trends?period=daily|weekly|monthly
- GET  /api/analytics/dos
- GET  /api/analytics/forecasts
- GET  /api/analytics/recommendations
- POST /api/analytics/refresh

### Export
- GET  /api/export/products/csv
- GET  /api/export/sales/csv
- GET  /api/export/report/pdf
- POST /api/upload/dataset

## Environment Variables (.env)

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=retail_inventory_db
JWT_SECRET=any_random_32_char_string
JWT_EXPIRES_IN=7d
PORT=5000
FRONTEND_URL=http://localhost:3000
```

## Analytics Methods

- ABC Analysis: Class A = top 80% revenue, B = next 15%, C = bottom 5%
- Stock Classification: Fast (>30 units/month), Slow (5–30), Dead (<5 or no sale in 90 days)
- Days of Supply: Current Stock ÷ Avg Daily Demand
- Demand Forecasting: Polynomial Linear Regression on daily sales history
