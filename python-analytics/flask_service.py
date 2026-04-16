"""
flask_service.py
-----------------
Optional Flask microservice that exposes the Python analytics engine
over HTTP so the Node.js backend can call it without spawning child processes.

Run:  python python-analytics/flask_service.py
Port: 8000 (configurable via PORT env var)
"""

import os, json
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from analytics_engine import AnalyticsEngine

app  = Flask(__name__)
CORS(app)

DATA_DIR   = os.path.join(os.path.dirname(__file__), "data")
SALES_PATH = os.path.join(DATA_DIR, "sales_history.csv")
PRODS_PATH = os.path.join(DATA_DIR, "products.csv")

# ── Lazy-load engine once ────────────────────────────────────
_engine = None

def get_engine() -> AnalyticsEngine:
    global _engine
    if _engine is None:
        sales_df    = pd.read_csv(SALES_PATH, parse_dates=["sale_date"])
        products_df = pd.read_csv(PRODS_PATH)
        _engine = AnalyticsEngine(sales_df, products_df)
    return _engine


def _jsonify_safe(obj):
    """Recursively convert numpy / pandas types to Python natives."""
    import numpy as np
    if isinstance(obj, dict):   return {k: _jsonify_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):   return [_jsonify_safe(i) for i in obj]
    if isinstance(obj, (np.integer,)):  return int(obj)
    if isinstance(obj, (np.floating,)): return float(obj)
    if hasattr(obj, "isoformat"):       return obj.isoformat()
    return obj


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "retail-analytics"})


@app.route("/analytics/kpis")
def kpis():
    data = get_engine().kpi_summary()
    return jsonify({"success": True, "data": _jsonify_safe(data)})


@app.route("/analytics/abc")
def abc():
    df = get_engine().abc_analysis()
    return jsonify({"success": True, "data": _jsonify_safe(df.to_dict(orient="records"))})


@app.route("/analytics/trends")
def trends():
    period = request.args.get("period", "monthly")
    data   = get_engine().sales_trends()
    return jsonify({"success": True, "data": _jsonify_safe(data.get(period, []))})


@app.route("/analytics/dos")
def dos():
    df = get_engine().days_of_supply()
    return jsonify({"success": True, "data": _jsonify_safe(df.to_dict(orient="records"))})


@app.route("/analytics/stock-classification")
def stock_class():
    df = get_engine().stock_classification()
    return jsonify({"success": True, "data": _jsonify_safe(df.to_dict(orient="records"))})


@app.route("/analytics/recommendations")
def recommendations():
    data = get_engine().restock_recommendations()
    return jsonify({"success": True, "data": _jsonify_safe(data)})


@app.route("/analytics/forecast/<int:product_id>")
def forecast(product_id):
    horizon = int(request.args.get("horizon", 30))
    data    = get_engine().demand_forecast(product_id, horizon)
    return jsonify({"success": True, "data": _jsonify_safe(data)})


@app.route("/analytics/refresh", methods=["POST"])
def refresh():
    global _engine
    _engine = None          # reset → reload on next call
    get_engine()            # warm up
    return jsonify({"success": True, "message": "Engine refreshed"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"🐍 Analytics microservice running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
