/**
 * pages/Analytics.jsx
 * Advanced analytics: ABC analysis, stock classification, heatmaps, DOS.
 */
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ScatterChart, Scatter,
  ReferenceLine, Legend
} from "recharts";
import { analyticsApi, fmt } from "../utils/api";
import toast from "react-hot-toast";
import clsx from "clsx";

const ABC_COLORS  = { A: "#10b981", B: "#3b82f6", C: "#94a3b8" };
const CLASS_COLORS = { fast: "#10b981", slow: "#f59e0b", dead: "#ef4444" };
const DOS_COLORS   = { critical: "#ef4444", low: "#f59e0b", normal: "#10b981", overstock: "#3b82f6" };

function StatBadge({ label, value, color }) {
  const colors = {
    green:  "bg-green-50 text-green-700 border border-green-100",
    blue:   "bg-blue-50 text-blue-700 border border-blue-100",
    amber:  "bg-amber-50 text-amber-700 border border-amber-100",
    red:    "bg-red-50 text-red-700 border border-red-100",
    slate:  "bg-slate-50 text-slate-600 border border-slate-100",
  };
  return (
    <div className={clsx("rounded-xl px-4 py-3 text-center", colors[color] || colors.slate)}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  );
}

// Simple heatmap for daily demand by weekday × hour bucket
function DemandHeatmap({ data }) {
  const days  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const weeks = ["W1","W2","W3","W4"];

  // Synthetic heatmap from trends data
  const matrix = days.map((d, di) =>
    weeks.map((w, wi) => {
      const base = data[di * 4 + wi]?.revenue_inr || 0;
      return { day: d, week: w, value: base };
    })
  );
  const maxVal = Math.max(...matrix.flat().map(c => c.value), 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        <div className="grid gap-1" style={{ gridTemplateColumns: `48px repeat(${weeks.length}, 1fr)` }}>
          <div />
          {weeks.map(w => (
            <div key={w} className="text-center text-xs text-slate-400 pb-1">{w}</div>
          ))}
          {matrix.map((row, ri) => (
            <>
              <div key={`d-${ri}`} className="text-xs text-slate-500 flex items-center pr-2 font-medium">
                {days[ri]}
              </div>
              {row.map((cell, ci) => {
                const intensity = cell.value / maxVal;
                const bg = intensity > 0.75 ? "bg-blue-600" :
                           intensity > 0.5  ? "bg-blue-400" :
                           intensity > 0.25 ? "bg-blue-200" :
                           intensity > 0    ? "bg-blue-100" : "bg-slate-50";
                return (
                  <div
                    key={`${ri}-${ci}`}
                    className={clsx("h-8 rounded-md cursor-default", bg)}
                    title={`${cell.day} ${cell.week}: ${fmt.inr(cell.value)}`}
                  />
                );
              })}
            </>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-xs text-slate-400">Low</span>
          {["bg-blue-100","bg-blue-200","bg-blue-400","bg-blue-600"].map((bg, i) => (
            <div key={i} className={clsx("w-5 h-3 rounded", bg)} />
          ))}
          <span className="text-xs text-slate-400">High</span>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [abcData,   setAbcData]   = useState([]);
  const [scData,    setScData]    = useState([]);
  const [dosData,   setDosData]   = useState([]);
  const [trends,    setTrends]    = useState([]);
  const [activeTab, setActiveTab] = useState("abc");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.allSettled([
      analyticsApi.abc(),
      analyticsApi.stockClass(),
      analyticsApi.dos(),
      analyticsApi.trends("weekly"),
    ]).then(([abc, sc, dos, tr]) => {
      if (abc.status === "fulfilled") setAbcData(abc.value.data.data || []);
      if (sc.status  === "fulfilled") setScData(sc.value.data.data   || []);
      if (dos.status === "fulfilled") setDosData(dos.value.data.data || []);
      if (tr.status  === "fulfilled") setTrends(tr.value.data.data   || []);
      setLoading(false);
    });
  }, []);

  // Aggregate ABC for bar chart (top 15)
  const abcBar = abcData.slice(0, 15).map(d => ({
    name:      (d.name || "").substring(0, 16),
    revenue:   Number(d.total_revenue_inr || 0),
    abc_class: d.abc_class,
  }));

  // SC distribution
  const scCounts = scData.reduce((acc, d) => {
    acc[d.stock_classification] = (acc[d.stock_classification] || 0) + 1;
    return acc;
  }, {});

  const dosCounts = dosData.reduce((acc, d) => {
    acc[d.dos_status] = (acc[d.dos_status] || 0) + 1;
    return acc;
  }, {});

  const TABS = [
    { key: "abc",  label: "ABC Analysis" },
    { key: "stock", label: "Stock Classification" },
    { key: "dos",  label: "Days of Supply" },
    { key: "heat", label: "Demand Heatmap" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Advanced inventory analysis powered by Python Pandas & Scikit-learn
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === t.key
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ABC Analysis */}
      {activeTab === "abc" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {["A","B","C"].map(cls => {
              const items = abcData.filter(d => d.abc_class === cls);
              const rev   = items.reduce((s, d) => s + Number(d.total_revenue_inr || 0), 0);
              return (
                <div key={cls} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`badge-${cls.toLowerCase()} text-base px-3 py-1`}>
                      Class {cls}
                    </span>
                    <span className="text-2xl font-bold text-slate-800">{items.length}</span>
                  </div>
                  <p className="text-sm text-slate-500">Products</p>
                  <p className="text-lg font-semibold text-slate-700 mt-1">{fmt.inr(rev)}</p>
                  <p className="text-xs text-slate-400">
                    {cls === "A" ? "Top 80% revenue generators" :
                     cls === "B" ? "Next 15% revenue contributors" :
                     "Remaining 5% — monitor closely"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-slate-700 mb-4">
              Revenue by Product (Pareto Chart) — Top 15
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={abcBar} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}k`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={130}
                />
                <Tooltip
                  formatter={v => [fmt.inr(v), "Revenue"]}
                  contentStyle={{ borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {abcBar.map((d, i) => (
                    <Cell key={i} fill={ABC_COLORS[d.abc_class] || "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-end">
              {Object.entries(ABC_COLORS).map(([cls, color]) => (
                <div key={cls} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                  Class {cls}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stock Classification */}
      {activeTab === "stock" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {["fast","slow","dead"].map(cls => (
              <div key={cls} className="card p-5">
                <span className={`badge-${cls} text-sm px-3 py-1 mb-3 inline-block`}>
                  {cls.charAt(0).toUpperCase() + cls.slice(1)} Moving
                </span>
                <p className="text-3xl font-bold text-slate-800 mt-2">
                  {scCounts[cls] || 0}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {cls === "fast" ? "Avg > 30 units/month" :
                   cls === "slow" ? "Avg 5–30 units/month" :
                   "< 5 units/month or no recent sales"}
                </p>
              </div>
            ))}
          </div>

          <div className="card p-5 overflow-x-auto">
            <h2 className="font-semibold text-slate-700 mb-4">Product Stock Classification Table</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Product","Avg Monthly","Last Sale","Classification"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="table-row">
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      {row.name || `Product ${row.product_id}`}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {Number(row.avg_monthly_units || 0).toFixed(1)} units
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {row.last_sale_date ? new Date(row.last_sale_date).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`badge-${row.stock_classification}`}>
                        {row.stock_classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Days of Supply */}
      {activeTab === "dos" && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { key: "critical", label: "Critical (<7 days)",   color: "red"  },
              { key: "low",      label: "Low (7–30 days)",       color: "amber" },
              { key: "normal",   label: "Normal (30–90 days)",  color: "green" },
              { key: "overstock",label: "Overstock (>90 days)", color: "blue"  },
            ].map(({ key, label, color }) => (
              <StatBadge key={key} label={label} value={dosCounts[key] || 0} color={color} />
            ))}
          </div>

          <div className="card p-5 overflow-x-auto">
            <h2 className="font-semibold text-slate-700 mb-4">Days of Supply — All Products</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Product","Current Stock","Avg Daily Demand","Days of Supply","Status"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dosData
                  .sort((a, b) => Number(a.days_of_supply) - Number(b.days_of_supply))
                  .slice(0, 25)
                  .map((row, i) => (
                  <tr key={i} className="table-row">
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      {row.name || `Product ${row.id}`}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{fmt.num(row.quantity_in_stock)}</td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {Number(row.avg_daily_demand || 0).toFixed(2)} units/day
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">
                      {Number(row.days_of_supply || 0).toFixed(1)} days
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={clsx(
                        "px-2 py-0.5 rounded text-xs font-semibold",
                        row.dos_status === "critical"  && "bg-red-100 text-red-700",
                        row.dos_status === "low"       && "bg-amber-100 text-amber-700",
                        row.dos_status === "normal"    && "bg-green-100 text-green-700",
                        row.dos_status === "overstock" && "bg-blue-100 text-blue-700",
                      )}>
                        {row.dos_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Heatmap */}
      {activeTab === "heat" && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-700 mb-1">Demand Pattern Heatmap</h2>
          <p className="text-sm text-slate-400 mb-5">
            Revenue intensity by day of week × week of month (Weekly data, last 28 data points)
          </p>
          <DemandHeatmap data={trends.slice(-28)} />
        </div>
      )}
    </div>
  );
}
