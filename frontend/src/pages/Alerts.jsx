/**
 * pages/Alerts.jsx
 */
import { useState, useEffect } from "react";
import { Bell, CheckCircle, AlertTriangle, AlertOctagon, RefreshCw } from "lucide-react";
import { alertsApi, fmt } from "../utils/api";
import toast from "react-hot-toast";
import clsx from "clsx";

const SEVERITY_STYLE = {
  critical: "border-l-4 border-red-500 bg-red-50",
  warning:  "border-l-4 border-amber-400 bg-amber-50",
  info:     "border-l-4 border-blue-400 bg-blue-50",
};
const SEVERITY_ICON = {
  critical: <AlertOctagon size={16} className="text-red-500" />,
  warning:  <AlertTriangle size={16} className="text-amber-500" />,
  info:     <Bell size={16} className="text-blue-500" />,
};
const TYPE_LABELS = {
  low_stock:   "Low Stock",
  overstock:   "Overstock",
  dead_stock:  "Dead Stock",
  high_demand: "High Demand",
};

export default function Alerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([alertsApi.getAll({ limit: 100 }), alertsApi.getSummary()]);
      setAlerts(aRes.data.data || []);
      setSummary(sRes.data.data || {});
    } catch { toast.error("Failed to load alerts"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id) => {
    await alertsApi.markRead(id);
    setAlerts(a => a.map(x => x.id === id ? { ...x, is_read: 1 } : x));
  };

  const handleGenerate = async () => {
    try {
      const res = await alertsApi.generate();
      toast.success(res.data.message);
      load();
    } catch { toast.error("Failed to generate alerts"); }
  };

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.alert_type === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alerts & Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">{summary.unread || 0} unread alerts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary">
            <RefreshCw size={15} /> Refresh
          </button>
          <button onClick={handleGenerate} className="btn-primary">
            <AlertTriangle size={15} /> Generate Alerts
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label:"Total",    value: summary.total    || 0, color:"text-slate-700" },
          { label:"Unread",   value: summary.unread   || 0, color:"text-blue-600"  },
          { label:"Critical", value: summary.critical || 0, color:"text-red-600"   },
          { label:"Low Stock",value: summary.low_stock|| 0, color:"text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: "all",       label: "All" },
          { key: "low_stock", label: "Low Stock" },
          { key: "overstock", label: "Overstock" },
          { key: "dead_stock",label: "Dead Stock" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              "px-4 py-1.5 rounded-xl text-sm font-medium border transition-all",
              filter === key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))
          : filtered.length === 0
          ? (
            <div className="card p-10 text-center text-slate-400">
              <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
              <p>No alerts found for this filter</p>
            </div>
          )
          : filtered.map(a => (
            <div
              key={a.id}
              className={clsx(
                "card p-4 flex items-start gap-3 transition-all",
                SEVERITY_STYLE[a.severity] || "",
                a.is_read && "opacity-60"
              )}
            >
              <div className="mt-0.5">{SEVERITY_ICON[a.severity]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {TYPE_LABELS[a.alert_type] || a.alert_type}
                  </span>
                  {!a.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-slate-700 font-medium">{a.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(a.created_at).toLocaleString("en-IN")}
                  {a.product_name && ` · ${a.product_name}`}
                </p>
              </div>
              {!a.is_read && (
                <button
                  onClick={() => handleMarkRead(a.id)}
                  className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}
