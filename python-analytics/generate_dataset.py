"""
generate_dataset.py
-------------------
Generates a realistic Indian retail inventory dataset (INR ₹).
Inspired by Kaggle's "Supermarket Sales" and "Retail Store Inventory Forecasting" datasets.
Outputs:
  - products.csv
  - sales_history.csv
  - inventory_transactions.csv

Run: python python-analytics/generate_dataset.py
"""

import pandas as pd
import numpy as np
from datetime import date, timedelta
import random
import os

random.seed(42)
np.random.seed(42)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Product catalog ──────────────────────────────────────────
PRODUCTS = [
    # (name, category_id, supplier_id, unit_price_inr, cost_price_inr, reorder_level, reorder_qty)
    ("Samsung Galaxy M14",     1, 1,  13999, 11200,  5, 20),
    ("Boat Airdopes 141",      1, 7,   1499,   950,  15, 50),
    ("MI 43\" LED TV",         1, 1,  28999, 22000,   3, 10),
    ("HP Wireless Mouse",      1, 7,    699,   400,  20, 60),
    ("Realme Buds Air 3",      1, 7,   2499,  1600,  10, 30),
    ("Levi's Slim Fit Jeans",  2, 3,   2499,  1200,  10, 30),
    ("Allen Solly Shirt",      2, 3,   1299,   650,  15, 40),
    ("Nike Running Shoes",     2, 1,   4999,  2800,   8, 25),
    ("Fabindia Kurta",         2, 4,    999,   450,  12, 35),
    ("Puma Track Pants",       2, 7,   1799,   900,  10, 30),
    ("Aashirvaad Atta 10kg",   3, 2,    450,   310,  30, 100),
    ("Amul Butter 500g",       3, 2,    275,   195,  40, 120),
    ("Tata Salt 1kg",          3, 2,     28,    18,  50, 150),
    ("Nescafe Classic 200g",   3, 3,    450,   295,  25, 80),
    ("Haldirams Bhujia 400g",  3, 4,    185,   110,  35, 100),
    ("Prestige Pressure Cooker",4, 5,  1999,  1100,   8, 25),
    ("Milton Casserole Set",   4, 5,    899,   480,  10, 30),
    ("Pigeon Non-Stick Pan",   4, 6,    699,   380,  12, 35),
    ("Usha Mixer Grinder",     4, 5,   3499,  2100,   5, 15),
    ("Tupperware Bottle",      4, 7,    699,   350,  15, 50),
    ("Himalaya Face Wash",     5, 5,    175,    90,  25, 80),
    ("Dabur Chyawanprash 1kg", 5, 6,    480,   285,  20, 60),
    ("Patanjali Dant Kanti",   5, 6,     85,    42,  30, 100),
    ("Dove Shampoo 340ml",     5, 3,    349,   195,  20, 70),
    ("Nivea Body Lotion 400ml",5, 1,    399,   220,  15, 50),
    ("Nivia Football",         6, 7,    499,   270,  10, 30),
    ("Cosco Badminton Racket", 6, 7,    899,   480,  8,  25),
    ("Decathlon Yoga Mat",     6, 1,    999,   550,  6,  20),
    ("Yonex Badminton Shuttle",6, 7,    350,   175,  20, 60),
    ("Strauss Dumbbell 5kg",   6, 1,    999,   530,  8,  25),
    ("Rich Dad Poor Dad",      7, 7,    399,   175,  10, 30),
    ("Atomic Habits",          7, 7,    499,   218,  10, 30),
    ("NCERT Physics Part-1",   7, 2,    145,    75,  15, 50),
    ("Camlin Geometry Box",    7, 4,    185,    88,  20, 60),
    ("Reynolds Ball Pen 10pk", 7, 4,     95,    42,  30, 100),
    ("LEGO Classic Set",       8, 7,   2999,  1800,   5, 15),
    ("Hot Wheels 5-pack",      8, 7,    599,   320,  12, 40),
    ("Funskool Monopoly",      8, 7,    999,   540,  8,  25),
    ("Crayola Crayons 64",     8, 3,    425,   215,  15, 50),
    ("Hasbro Jenga",           8, 7,    699,   360,  8,  25),
]

# ── Build products DataFrame ─────────────────────────────────
products_data = []
for idx, (name, cat_id, sup_id, price, cost, reorder_lvl, reorder_qty) in enumerate(PRODUCTS, start=1):
    # Simulate realistic stock levels
    stock = random.randint(0, 120)
    products_data.append({
        "id": idx,
        "sku": f"SKU{str(idx).zfill(4)}",
        "name": name,
        "category_id": cat_id,
        "supplier_id": sup_id,
        "unit_price": price,
        "cost_price": cost,
        "quantity_in_stock": stock,
        "reorder_level": reorder_lvl,
        "reorder_quantity": reorder_qty,
    })

df_products = pd.DataFrame(products_data)
df_products.to_csv(f"{OUTPUT_DIR}/products.csv", index=False)
print(f"✓ products.csv: {len(df_products)} rows")

# ── Generate 2 years of daily sales ─────────────────────────
start_date = date(2023, 1, 1)
end_date   = date(2024, 12, 31)
date_range = [start_date + timedelta(days=d) for d in range((end_date - start_date).days + 1)]

REGIONS = ["North India", "South India", "East India", "West India", "Central India"]
CITIES  = ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"]
CUST_TYPES = ["retail", "wholesale", "online"]

sales_rows = []
invoice_counter = 1

for single_date in date_range:
    # Seasonality: sales spike Nov-Jan (festive) and Apr-Jun (summer)
    month = single_date.month
    day_of_week = single_date.weekday()  # 0=Mon … 6=Sun

    base_txns = 15 if month in (10, 11, 12, 1) else (10 if month in (4, 5, 6) else 7)
    weekend_boost = 1.4 if day_of_week >= 5 else 1.0
    n_txns = max(1, int(base_txns * weekend_boost + random.randint(-3, 3)))

    for _ in range(n_txns):
        product = random.choice(products_data)
        qty_sold = np.random.poisson(lam=max(1, product["reorder_level"] // 5)) + 1
        price = product["unit_price"] * random.uniform(0.95, 1.05)  # price variation
        discount = random.choice([0, 0, 0, 5, 10, 15, 20])

        final_price  = round(price * (1 - discount / 100), 2)
        total_amount = round(final_price * qty_sold, 2)

        sales_rows.append({
            "invoice_no":    f"INV{str(invoice_counter).zfill(8)}",
            "product_id":    product["id"],
            "quantity_sold": qty_sold,
            "unit_price":    round(final_price, 2),
            "total_amount":  total_amount,
            "discount_pct":  discount,
            "customer_type": random.choice(CUST_TYPES),
            "region":        random.choice(REGIONS),
            "city":          random.choice(CITIES),
            "sale_date":     single_date.isoformat(),
        })
        invoice_counter += 1

df_sales = pd.DataFrame(sales_rows)
df_sales.to_csv(f"{OUTPUT_DIR}/sales_history.csv", index=False)
print(f"✓ sales_history.csv: {len(df_sales):,} rows  |  Revenue: ₹{df_sales['total_amount'].sum():,.0f}")

# ── Summary statistics ────────────────────────────────────────
print("\n── Dataset Summary ──────────────────────────────────────")
print(f"  Products       : {len(df_products)}")
print(f"  Sales records  : {len(df_sales):,}")
print(f"  Date range     : {start_date} → {end_date}")
print(f"  Total revenue  : ₹{df_sales['total_amount'].sum():,.0f}")
print(f"  Avg daily rev  : ₹{df_sales.groupby('sale_date')['total_amount'].sum().mean():,.0f}")
print("─────────────────────────────────────────────────────────\n")
