/**
 * pages/Dashboard.jsx
 * Main admin dashboard with KPIs, sales trend, top products, alerts.
 */
import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import {
  IndianRupee, Package, AlertTriangle, TrendingUp,
  ShoppingCart, BarChart2, ArrowRight, RefreshCw
} from "lucide-react";
import { analyticsApi, alertsApi, fmt } from "../utils/api";
import KpiCard from "../components/dashboard/KpiCard";
import toast from "react-hot-toast";

const CATEGORY_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#06b6d4","#f97316","#84cc16",
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.name?.includes("revenue") ? fmt.inr(p.value) : fmt.num(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [kpis,       setKpis]       = useState(null);
  const [trends,     setTrends]     = useState([]);
  const [catDist,    setCatDist]    = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [recos,      setRecos]      = useState([]);
  const [trendPeriod, setTrendPeriod] = useState("monthly");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [kpiRes, trendRes, catRes, alertRes, recoRes] = await Promise.allSettled([
        analyticsApi.kpis(),
        analyticsApi.trends(trendPeriod),
        analyticsApi.categoryDist(),
        alertsApi.getAll({ is_read: false, limit: 8 }),
        analyticsApi.recommendations(),
      ]);

      if (kpiRes.status === "fulfilled")   setKpis(kpiRes.value.data.data);
      if (trendRes.status === "fulfilled") setTrends(trendRes.value.data.data);
      if (catRes.status === "fulfilled")   setCatDist(catRes.value.data.data);
      if (alertRes.status === "fulfilled") setAlerts(alertRes.value.data.data);
      if (recoRes.status === "fulfilled")  setRecos(recoRes.value.data.data?.slice(0, 5));
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [trendPeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await analyticsApi.refresh();
      await loadData();
      toast.success("Analytics refreshed successfully");
    } catch {
      toast.error("Refresh failed — check Python service");
    } finally {
      setRefreshing(false);
    }
  };

  // Transform trends for chart
  const trendChartData = trends.slice(-60).map(d => ({
    ...d,
    label: d.sale_date || d.week || d.month || "",
    revenue_inr: Number(d.revenue_inr || 0),
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Retail Inventory Insights — All figures in Indian Rupees (₹)
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh Analytics"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue"
          value={fmt.inr(kpis?.total_revenue_inr)}
          subValue="All time"
          trend={kpis?.mom_growth_pct}
          icon={IndianRupee}
          color="blue"
          loading={loading}
        />
        <KpiCard
          label="Inventory Value"
          value={fmt.inr(kpis?.inventory_value_inr)}
          subValue="Current stock at cost"
          icon={Package}
          color="green"
          loading={loading}
        />
        <KpiCard
          label="Low Stock Items"
          value={fmt.num(kpis?.low_stock_items)}
          subValue={`of ${fmt.num(kpis?.total_products)} products`}
          icon={AlertTriangle}
          color="amber"
          loading={loading}
        />
        <KpiCard
          label="This Month"
          value={fmt.inr(kpis?.this_month_revenue)}
          subValue="Revenue (MTD)"
          trend={kpis?.mom_growth_pct}
          icon={TrendingUp}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales trend line chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700">Sales Trend</h2>
            <div className="flex gap-1">
              {["daily","weekly","monthly"].map(p => (
                <button
                  key={p}
                  onClick={() => setTrendPeriod(p)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    trendPeriod === p
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => v.length > 8 ? v.slice(5) : v}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={v => `₹${(v/1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue_inr"
                name="Revenue (₹)"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-700 mb-4">Revenue by Category</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={catDist}
                dataKey="revenue_inr"
                nameKey="category"
                cx="50%" cy="50%"
                outerRadius={80}
                innerRadius={45}
              >
                {catDist.map((_, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [fmt.inr(v), n]}
              />
              <Legend
                iconSize={8}
                formatter={(v) => <span className="text-xs text-slate-600">{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row: Top products + Restock alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top sellers */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <BarChart2 size={17} className="text-blue-500" />
              Top Products
            </h2>
          </div>
          <div className="space-y-3">
            {(kpis?.top_sellers || []).map((p, i) => (
              <div key={p.product_id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                </div>
                <p className="text-sm font-semibold text-blue-600">{fmt.inr(p.revenue_inr)}</p>
              </div>
            ))}
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-6 h-6 rounded-lg bg-slate-100" />
                <div className="flex-1 h-4 bg-slate-100 rounded" />
                <div className="w-20 h-4 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Restock recommendations */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle size={17} className="text-amber-500" />
              Restock Needed
            </h2>
            <span className="text-xs text-slate-400">{recos?.length || 0} items</span>
          </div>
          <div className="space-y-2.5">
            {(recos || []).map(r => (
              <div key={r.product_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                <div className={`w-2 h-8 rounded-full flex-shrink-0 ${
                  r.priority === "HIGH" ? "bg-red-500" :
                  r.priority === "MEDIUM" ? "bg-amber-400" : "bg-slate-300"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{r.product_name}</p>
                  <p className="text-xs text-slate-400">
                    {r.current_stock} units • {r.days_of_supply?.toFixed(0)} days supply
                  </p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  r.priority === "HIGH"   ? "bg-red-100 text-red-600" :
                  r.priority === "MEDIUM" ? "bg-amber-100 text-amber-600" :
                                            "bg-slate-100 text-slate-500"
                }`}>
                  {r.priority}
                </span>
              </div>
            ))}
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2.5 animate-pulse">
                <div className="w-2 h-8 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
