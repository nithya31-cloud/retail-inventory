"""
analytics_engine.py
--------------------
Core data analysis module for Retail Inventory Insights.
Provides:
  - ABC Analysis (Pareto Principle)
  - Stock Classification (Fast/Slow/Dead)
  - Demand Forecasting (Linear Regression + ARIMA-lite)
  - Days of Supply (DOS)
  - Sales Trend Analysis
  - Inventory Optimization Recommendations

Usage (standalone):
    python python-analytics/analytics_engine.py

Usage (as module):
    from analytics_engine import AnalyticsEngine
    engine = AnalyticsEngine(sales_df, products_df)
    results = engine.run_full_analysis()
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.metrics import mean_absolute_error
import warnings, json, os, sys

warnings.filterwarnings("ignore")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


# ═══════════════════════════════════════════════════════════════
class AnalyticsEngine:
    """
    Main analytics engine for retail inventory insights.
    All monetary values in Indian Rupees (₹).
    """

    USD_TO_INR = 83.5  # Exchange rate for any USD→INR conversions

    def __init__(self, sales_df: pd.DataFrame, products_df: pd.DataFrame):
        self.sales    = sales_df.copy()
        self.products = products_df.copy()

        # Ensure date column is datetime
        self.sales["sale_date"] = pd.to_datetime(self.sales["sale_date"])

    # ─────────────────────────────────────────────────────────
    # 1. ABC ANALYSIS (Pareto 80/95/100 principle)
    # ─────────────────────────────────────────────────────────
    def abc_analysis(self) -> pd.DataFrame:
        """
        Classifies products into A / B / C based on revenue contribution.
          A → top 80% of revenue  (typically 20% of products)
          B → next 15% of revenue
          C → remaining 5%
        """
        revenue_per_product = (
            self.sales.groupby("product_id")["total_amount"]
            .sum()
            .reset_index()
            .rename(columns={"total_amount": "total_revenue_inr"})
        )

        revenue_per_product = revenue_per_product.merge(
            self.products[["id", "name", "category_id"]],
            left_on="product_id", right_on="id", how="left"
        )

        revenue_per_product.sort_values("total_revenue_inr", ascending=False, inplace=True)
        total_rev = revenue_per_product["total_revenue_inr"].sum()
        revenue_per_product["cumulative_pct"] = (
            revenue_per_product["total_revenue_inr"].cumsum() / total_rev * 100
        )
        revenue_per_product["revenue_pct"] = (
            revenue_per_product["total_revenue_inr"] / total_rev * 100
        )

        def classify(cum_pct):
            if cum_pct <= 80: return "A"
            elif cum_pct <= 95: return "B"
            return "C"

        revenue_per_product["abc_class"] = revenue_per_product["cumulative_pct"].apply(classify)
        return revenue_per_product

    # ─────────────────────────────────────────────────────────
    # 2. STOCK CLASSIFICATION (Fast / Slow / Dead)
    # ─────────────────────────────────────────────────────────
    def stock_classification(self) -> pd.DataFrame:
        """
        Classifies products by movement velocity:
          fast → avg monthly sales > 30 units
          slow → avg monthly sales 5–30 units
          dead → avg monthly sales < 5 units OR no sales in 90 days
        """
        monthly_sales = (
            self.sales.assign(month=self.sales["sale_date"].dt.to_period("M"))
            .groupby(["product_id", "month"])["quantity_sold"]
            .sum()
            .reset_index()
        )
        avg_monthly = (
            monthly_sales.groupby("product_id")["quantity_sold"]
            .mean()
            .reset_index()
            .rename(columns={"quantity_sold": "avg_monthly_units"})
        )

        # Last sale date per product
        last_sale = (
            self.sales.groupby("product_id")["sale_date"]
            .max()
            .reset_index()
            .rename(columns={"sale_date": "last_sale_date"})
        )

        result = avg_monthly.merge(last_sale, on="product_id", how="left")
        cutoff  = self.sales["sale_date"].max() - pd.Timedelta(days=90)

        def classify(row):
            if row["last_sale_date"] < cutoff: return "dead"
            if row["avg_monthly_units"] >= 30:  return "fast"
            if row["avg_monthly_units"] >= 5:   return "slow"
            return "dead"

        result["stock_classification"] = result.apply(classify, axis=1)
        return result

    # ─────────────────────────────────────────────────────────
    # 3. DEMAND FORECASTING (Linear Regression with polynomial features)
    # ─────────────────────────────────────────────────────────
    def demand_forecast(self, product_id: int, horizon_days: int = 30) -> dict:
        """
        Forecasts daily demand for a product for the next `horizon_days`.
        Uses Polynomial Linear Regression on historical daily sales.
        Returns predicted quantities and confidence bounds.
        """
        prod_sales = (
            self.sales[self.sales["product_id"] == product_id]
            .groupby("sale_date")["quantity_sold"]
            .sum()
            .reset_index()
            .sort_values("sale_date")
        )

        if len(prod_sales) < 14:
            return {"error": "Insufficient data for forecasting (< 14 days)"}

        # Feature: ordinal day number
        prod_sales["day_num"] = (
            prod_sales["sale_date"] - prod_sales["sale_date"].min()
        ).dt.days.values

        X = prod_sales[["day_num"]].values
        y = prod_sales["quantity_sold"].values

        # Polynomial degree-2 for seasonal curves
        poly   = PolynomialFeatures(degree=2, include_bias=False)
        X_poly = poly.fit_transform(X)

        model = LinearRegression()
        model.fit(X_poly, y)

        y_pred = model.predict(X_poly)
        mae    = mean_absolute_error(y, y_pred)

        # Forecast future days
        last_day = int(prod_sales["day_num"].max())
        future_days   = np.array([[last_day + i] for i in range(1, horizon_days + 1)])
        future_poly   = poly.transform(future_days)
        future_pred   = model.predict(future_poly)
        future_pred   = np.maximum(future_pred, 0)  # No negative demand

        last_date = prod_sales["sale_date"].max()
        forecast_dates = [
            (last_date + pd.Timedelta(days=i)).date().isoformat()
            for i in range(1, horizon_days + 1)
        ]

        confidence = max(0, min(95, 100 - (mae / (y.mean() + 1e-9) * 100)))

        return {
            "product_id":     product_id,
            "model":          "polynomial_linear_regression",
            "mae":            round(float(mae), 2),
            "confidence_pct": round(float(confidence), 1),
            "horizon_days":   horizon_days,
            "forecasts": [
                {
                    "date":        forecast_dates[i],
                    "predicted":   max(0, round(float(future_pred[i]), 1)),
                    "lower_bound": max(0, round(float(future_pred[i] - mae), 1)),
                    "upper_bound": round(float(future_pred[i] + mae), 1),
                }
                for i in range(horizon_days)
            ],
            "total_forecast_qty": round(float(future_pred.sum()), 0),
        }

    # ─────────────────────────────────────────────────────────
    # 4. DAYS OF SUPPLY (DOS)
    # ─────────────────────────────────────────────────────────
    def days_of_supply(self) -> pd.DataFrame:
        """
        Calculates Days of Supply = Current Stock / Avg Daily Demand.
        Thresholds: <7 days = critical, 7-30 = low, 30-90 = normal, >90 = overstock.
        """
        avg_daily = (
            self.sales.groupby("product_id")["quantity_sold"]
            .mean()  # mean per transaction ≈ daily proxy
            .reset_index()
            .rename(columns={"quantity_sold": "avg_daily_demand"})
        )

        result = self.products[["id", "name", "quantity_in_stock", "reorder_level"]].merge(
            avg_daily, left_on="id", right_on="product_id", how="left"
        )
        result["avg_daily_demand"] = result["avg_daily_demand"].fillna(0.1)
        result["days_of_supply"]   = result["quantity_in_stock"] / result["avg_daily_demand"]
        result["days_of_supply"]   = result["days_of_supply"].round(1)

        def classify_dos(dos):
            if dos < 7:    return "critical"
            if dos < 30:   return "low"
            if dos <= 90:  return "normal"
            return "overstock"

        result["dos_status"] = result["days_of_supply"].apply(classify_dos)
        return result

    # ─────────────────────────────────────────────────────────
    # 5. SALES TREND ANALYSIS
    # ─────────────────────────────────────────────────────────
    def sales_trends(self) -> dict:
        """Returns daily / weekly / monthly aggregated revenue in INR."""
        s = self.sales.copy()

        daily = (
            s.groupby("sale_date")
            .agg(revenue_inr=("total_amount", "sum"), units=("quantity_sold", "sum"))
            .reset_index()
        )
        daily["sale_date"] = daily["sale_date"].dt.date.astype(str)

        weekly = (
            s.assign(week=s["sale_date"].dt.to_period("W").astype(str))
            .groupby("week")
            .agg(revenue_inr=("total_amount", "sum"), units=("quantity_sold", "sum"))
            .reset_index()
        )

        monthly = (
            s.assign(month=s["sale_date"].dt.to_period("M").astype(str))
            .groupby("month")
            .agg(revenue_inr=("total_amount", "sum"), units=("quantity_sold", "sum"))
            .reset_index()
        )

        # MoM growth rate
        monthly["revenue_inr_prev"] = monthly["revenue_inr"].shift(1)
        monthly["mom_growth_pct"]   = (
            (monthly["revenue_inr"] - monthly["revenue_inr_prev"])
            / monthly["revenue_inr_prev"] * 100
        ).round(2)
        monthly.drop(columns=["revenue_inr_prev"], inplace=True)

        return {
            "daily":   daily.tail(90).to_dict(orient="records"),   # Last 90 days
            "weekly":  weekly.tail(52).to_dict(orient="records"),  # Last 52 weeks
            "monthly": monthly.to_dict(orient="records"),
        }

    # ─────────────────────────────────────────────────────────
    # 6. INVENTORY OPTIMIZATION RECOMMENDATIONS
    # ─────────────────────────────────────────────────────────
    def restock_recommendations(self) -> list[dict]:
        """
        Generates smart restock recommendations based on:
          - Days of Supply < 30
          - ABC class A/B items prioritised
          - Demand forecast for next 30 days
        """
        abc_df  = self.abc_analysis()
        dos_df  = self.days_of_supply()
        sc_df   = self.stock_classification()

        merged = dos_df.merge(
            abc_df[["product_id", "abc_class", "total_revenue_inr"]],
            left_on="id", right_on="product_id", how="left"
        ).merge(
            sc_df[["product_id", "stock_classification"]],
            left_on="id", right_on="product_id", how="left"
        )

        recommendations = []
        for _, row in merged[merged["dos_status"].isin(["critical", "low"])].iterrows():
            forecast = self.demand_forecast(int(row["id"]), horizon_days=30)
            forecast_qty = forecast.get("total_forecast_qty", 50)

            priority = "HIGH"   if row.get("abc_class") == "A" else \
                       "MEDIUM" if row.get("abc_class") == "B" else "LOW"

            recommendations.append({
                "product_id":        int(row["id"]),
                "product_name":      row["name"],
                "current_stock":     int(row["quantity_in_stock"]),
                "days_of_supply":    float(row["days_of_supply"]),
                "abc_class":         row.get("abc_class", "C"),
                "dos_status":        row["dos_status"],
                "stock_class":       row.get("stock_classification", "slow"),
                "forecast_30d_qty":  int(forecast_qty),
                "restock_qty":       max(int(forecast_qty * 1.2), int(row["reorder_level"]) * 3),
                "priority":          priority,
                "reason":            f"Only {row['days_of_supply']:.0f} days of stock remaining. "
                                     f"Forecast demand: {int(forecast_qty)} units/30 days.",
            })

        # Sort: HIGH priority first, then by DOS ascending
        priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        recommendations.sort(
            key=lambda x: (priority_order[x["priority"]], x["days_of_supply"])
        )
        return recommendations

    # ─────────────────────────────────────────────────────────
    # 7. KPI SUMMARY (Dashboard Header Cards)
    # ─────────────────────────────────────────────────────────
    def kpi_summary(self) -> dict:
        """Returns top-level KPIs for the admin dashboard."""
        total_revenue  = self.sales["total_amount"].sum()
        inventory_val  = (
            self.products["quantity_in_stock"] * self.products["cost_price"]
        ).sum()

        low_stock = (
            self.products["quantity_in_stock"] <= self.products["reorder_level"]
        ).sum()

        # Top 5 selling products by revenue
        top_sellers = (
            self.sales.groupby("product_id")["total_amount"]
            .sum()
            .sort_values(ascending=False)
            .head(5)
        )
        top_sellers_detail = []
        for pid, rev in top_sellers.items():
            prod_row = self.products[self.products["id"] == pid]
            if not prod_row.empty:
                top_sellers_detail.append({
                    "product_id": int(pid),
                    "name":       prod_row.iloc[0]["name"],
                    "revenue_inr": round(float(rev), 2),
                })

        # Dead stock products
        sc_df     = self.stock_classification()
        dead_count = (sc_df["stock_classification"] == "dead").sum()

        # This month vs last month revenue
        latest_month = self.sales["sale_date"].dt.to_period("M").max()
        prev_month   = latest_month - 1
        this_m_rev   = self.sales[
            self.sales["sale_date"].dt.to_period("M") == latest_month
        ]["total_amount"].sum()
        prev_m_rev   = self.sales[
            self.sales["sale_date"].dt.to_period("M") == prev_month
        ]["total_amount"].sum()
        mom_growth = ((this_m_rev - prev_m_rev) / (prev_m_rev + 1e-9) * 100)

        return {
            "total_revenue_inr":   round(float(total_revenue), 2),
            "inventory_value_inr": round(float(inventory_val), 2),
            "low_stock_items":     int(low_stock),
            "dead_stock_items":    int(dead_count),
            "total_products":      int(len(self.products)),
            "total_sales_records": int(len(self.sales)),
            "this_month_revenue":  round(float(this_m_rev), 2),
            "mom_growth_pct":      round(float(mom_growth), 2),
            "top_sellers":         top_sellers_detail,
        }

    # ─────────────────────────────────────────────────────────
    # 8. FULL ANALYSIS PIPELINE
    # ─────────────────────────────────────────────────────────
    def run_full_analysis(self) -> dict:
        """Runs all analytics modules and returns a consolidated results dict."""
        print("Running analytics pipeline...")

        abc    = self.abc_analysis()
        sc     = self.stock_classification()
        dos    = self.days_of_supply()
        trends = self.sales_trends()
        recos  = self.restock_recommendations()
        kpis   = self.kpi_summary()

        # Demand forecast for top 5 products
        top5 = (
            self.sales.groupby("product_id")["total_amount"]
            .sum()
            .sort_values(ascending=False)
            .head(5)
            .index
            .tolist()
        )
        forecasts = {pid: self.demand_forecast(pid, 30) for pid in top5}

        # Category distribution
        cat_sales = (
            self.sales.merge(
                self.products[["id", "category_id"]], left_on="product_id", right_on="id"
            )
            .groupby("category_id")["total_amount"]
            .sum()
            .reset_index()
            .rename(columns={"total_amount": "revenue_inr"})
        )

        results = {
            "kpis":                kpis,
            "abc_analysis":        abc.to_dict(orient="records"),
            "stock_classification": sc.to_dict(orient="records"),
            "days_of_supply":      dos.to_dict(orient="records"),
            "sales_trends":        trends,
            "restock_recommendations": recos,
            "demand_forecasts":    forecasts,
            "category_distribution": cat_sales.to_dict(orient="records"),
        }

        print(f"  ✓ KPIs              : Revenue ₹{kpis['total_revenue_inr']:,.0f}")
        print(f"  ✓ ABC Analysis      : {len(abc)} products classified")
        print(f"  ✓ DOS Analysis      : {len(dos)} products analysed")
        print(f"  ✓ Restock Recs      : {len(recos)} items flagged")
        print(f"  ✓ Demand Forecasts  : {len(forecasts)} products forecasted")
        return results


# ─────────────────────────────────────────────────────────────
# CLI ENTRY POINT
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    sales_path    = os.path.join(DATA_DIR, "sales_history.csv")
    products_path = os.path.join(DATA_DIR, "products.csv")

    if not os.path.exists(sales_path):
        print("Dataset not found. Run generate_dataset.py first.")
        sys.exit(1)

    sales_df    = pd.read_csv(sales_path, parse_dates=["sale_date"])
    products_df = pd.read_csv(products_path)

    engine  = AnalyticsEngine(sales_df, products_df)
    results = engine.run_full_analysis()

    output_path = os.path.join(DATA_DIR, "analytics_results.json")
    with open(output_path, "w") as f:
        # Make JSON-serialisable
        def convert(o):
            if isinstance(o, (np.integer,)):        return int(o)
            if isinstance(o, (np.floating,)):       return float(o)
            if isinstance(o, (np.ndarray,)):        return o.tolist()
            if hasattr(o, 'isoformat'):             return o.isoformat()
            if str(type(o)).startswith("<class 'pandas"): return str(o)
            raise TypeError(f"Not serialisable: {type(o)}")
        json.dump(results, f, indent=2, default=convert)

    print(f"\n✓ Results saved → {output_path}")
