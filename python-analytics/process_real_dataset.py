"""
process_real_dataset.py
-----------------------
Reads the REAL Kaggle supermarket_sales.csv dataset and rebuilds
all analytics (ABC, forecasting, DOS, stock classification) from it.

Dataset: https://www.kaggle.com/datasets/aungpyaeap/supermarket-sales
Columns: Invoice ID, Branch, City, Customer type, Gender, Product line,
         Unit price, Quantity, Tax 5%, Total, Date, Time, Payment,
         cogs, gross margin percentage, gross income, Rating

Usage:
    1. Download supermarket_sales.csv from Kaggle
    2. Place it in python-analytics/data/supermarket_sales.csv
    3. Run: python process_real_dataset.py
"""

import pandas as pd
import numpy as np
import json, os, sys
from analytics_engine import AnalyticsEngine

DATA_DIR   = os.path.join(os.path.dirname(__file__), "data")
RAW_CSV    = os.path.join(DATA_DIR, "supermarket_sales.csv")
OUTPUT_DIR = DATA_DIR

USD_TO_INR = 83.5   # Conversion rate

# ── Column name variants across different Kaggle uploads ─────
COL_ALIASES = {
    "invoice_id":   ["Invoice ID", "invoice_id", "InvoiceID"],
    "product_line": ["Product line", "Product Line", "product_line", "Category"],
    "unit_price":   ["Unit price", "Unit Price", "unit_price", "UnitPrice"],
    "quantity":     ["Quantity", "quantity", "Qty"],
    "total":        ["Total", "total", "Total Amount"],
    "date":         ["Date", "date", "Sale Date"],
    "city":         ["City", "city", "Branch"],
    "customer_type":["Customer type", "Customer Type", "customer_type"],
    "rating":       ["Rating", "rating"],
    "payment":      ["Payment", "payment"],
    "branch":       ["Branch", "branch"],
    "cogs":         ["cogs", "COGS", "Cost"],
    "gross_income": ["gross income", "Gross Income", "gross_income"],
}

def find_col(df, key):
    """Find a column by trying multiple alias names."""
    for alias in COL_ALIASES.get(key, [key]):
        if alias in df.columns:
            return alias
    return None

def load_and_clean():
    """
    Load the real Kaggle CSV, clean it, convert to INR,
    and return (sales_df, products_df) compatible with AnalyticsEngine.
    """
    if not os.path.exists(RAW_CSV):
        print(f"\n❌  File not found: {RAW_CSV}")
        print("\n  Please download the dataset from:")
        print("  https://www.kaggle.com/datasets/aungpyaeap/supermarket-sales")
        print(f"  and place it at: {RAW_CSV}\n")
        sys.exit(1)

    print(f"📂 Loading: {RAW_CSV}")
    df = pd.read_csv(RAW_CSV)

    print(f"   Raw shape : {df.shape}")
    print(f"   Columns   : {list(df.columns)}")

    # ── Standardise column names ──────────────────────────────
    col_map = {}
    for std, aliases in COL_ALIASES.items():
        for alias in aliases:
            if alias in df.columns:
                col_map[alias] = std
                break
    df.rename(columns=col_map, inplace=True)

    # ── Drop duplicates & nulls ───────────────────────────────
    before = len(df)
    df.drop_duplicates(inplace=True)
    df.dropna(subset=["invoice_id", "product_line", "unit_price", "quantity", "date"], inplace=True)
    print(f"   After clean: {len(df)} rows (removed {before - len(df)} dirty rows)")

    # ── Parse date ────────────────────────────────────────────
    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    df.dropna(subset=["date"], inplace=True)
    df["sale_date"] = df["date"].dt.date

    # ── Currency conversion: USD → INR ────────────────────────
    # Kaggle dataset prices are in local currency (approx USD-scale)
    # Multiply all monetary columns by USD_TO_INR
    for col in ["unit_price", "total", "cogs", "gross_income"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0) * USD_TO_INR

    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(1).astype(int)

    # Recompute total if missing or zero
    if "total" not in df.columns or df["total"].sum() == 0:
        df["total"] = df["unit_price"] * df["quantity"]

    print(f"   Date range : {df['date'].min().date()} → {df['date'].max().date()}")
    print(f"   Total revenue: ₹{df['total'].sum():,.0f}")

    # ── Build products table from unique product lines ────────
    product_lines = df["product_line"].dropna().unique()
    products_list = []
    for i, pl in enumerate(product_lines, start=1):
        subset      = df[df["product_line"] == pl]
        avg_price   = subset["unit_price"].mean()
        avg_qty_sold = subset["quantity"].mean()

        products_list.append({
            "id":                 i,
            "sku":                f"SKU{str(i).zfill(4)}",
            "name":               pl,
            "category_id":        i,
            "supplier_id":        1,
            "unit_price":         round(avg_price, 2),
            "cost_price":         round(avg_price * 0.65, 2),   # 35% margin assumption
            "quantity_in_stock":  int(np.random.randint(5, 120)),
            "reorder_level":      20,
            "reorder_quantity":   50,
        })

    products_df = pd.DataFrame(products_list)

    # ── Build sales table ─────────────────────────────────────
    # Map product_line → product_id
    pl_to_id = {row["name"]: row["id"] for _, row in products_df.iterrows()}

    sales_df = pd.DataFrame({
        "invoice_no":    df["invoice_id"].astype(str),
        "product_id":    df["product_line"].map(pl_to_id),
        "quantity_sold": df["quantity"],
        "unit_price":    df["unit_price"].round(2),
        "total_amount":  df["total"].round(2),
        "discount_pct":  0,
        "customer_type": df.get("customer_type", "retail"),
        "city":          df.get("city", "Unknown"),
        "sale_date":     df["sale_date"],
    })
    sales_df.dropna(subset=["product_id"], inplace=True)
    sales_df["product_id"] = sales_df["product_id"].astype(int)

    return sales_df, products_df


def run():
    print("\n" + "═"*55)
    print("  Retail Inventory — Real Dataset Processor")
    print("  Source: Kaggle aungpyaeap/supermarket-sales")
    print("═"*55 + "\n")

    sales_df, products_df = load_and_clean()

    # Save cleaned CSVs
    sales_df.to_csv(os.path.join(OUTPUT_DIR, "sales_history.csv"), index=False)
    products_df.to_csv(os.path.join(OUTPUT_DIR, "products.csv"), index=False)
    print(f"\n✓ Saved cleaned sales_history.csv  ({len(sales_df)} rows)")
    print(f"✓ Saved cleaned products.csv        ({len(products_df)} products)")

    # Run full analytics engine
    print("\n📊 Running analytics engine on real data...")
    engine  = AnalyticsEngine(sales_df, products_df)
    results = engine.run_full_analysis()

    # Save results
    out_path = os.path.join(OUTPUT_DIR, "analytics_results.json")

    def convert(o):
        if isinstance(o, (np.integer,)):      return int(o)
        if isinstance(o, (np.floating,)):     return float(o)
        if isinstance(o, (np.ndarray,)):      return o.tolist()
        if hasattr(o, "isoformat"):           return o.isoformat()
        if str(type(o)).startswith("<class 'pandas"): return str(o)
        raise TypeError(f"Not serialisable: {type(o)}")

    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=convert)

    kpis = results["kpis"]
    print("\n" + "─"*55)
    print(f"  ✓ Total Revenue     : ₹{kpis['total_revenue_inr']:,.0f}")
    print(f"  ✓ Inventory Value   : ₹{kpis['inventory_value_inr']:,.0f}")
    print(f"  ✓ Low Stock Items   : {kpis['low_stock_items']}")
    print(f"  ✓ Products          : {kpis['total_products']}")
    print(f"  ✓ Sales Records     : {kpis['total_sales_records']:,}")
    print(f"  ✓ ABC Analysis      : {len(results['abc_analysis'])} products classified")
    print(f"  ✓ Restock Recs      : {len(results['restock_recommendations'])} items flagged")
    print("─"*55)
    print(f"\n✅ Results saved → {out_path}")
    print("   Restart your backend to pick up the new analytics.\n")


if __name__ == "__main__":
    run()
