/**
 * components/dashboard/KpiCard.jsx
 */
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import clsx from "clsx";

export default function KpiCard({
  label, value, subValue, trend, icon: Icon, color = "blue", loading
}) {
  const colorMap = {
    blue:   { bg: "bg-blue-50",   text: "text-blue-600",   icon: "bg-blue-100" },
    green:  { bg: "bg-green-50",  text: "text-green-600",  icon: "bg-green-100" },
    amber:  { bg: "bg-amber-50",  text: "text-amber-600",  icon: "bg-amber-100" },
    red:    { bg: "bg-red-50",    text: "text-red-600",    icon: "bg-red-100" },
    purple: { bg: "bg-purple-50", text: "text-purple-600", icon: "bg-purple-100" },
  };
  const c = colorMap[color] || colorMap.blue;

  if (loading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-24 mb-3" />
        <div className="h-7 bg-slate-200 rounded w-32 mb-2" />
        <div className="h-3 bg-slate-100 rounded w-20" />
      </div>
    );
  }

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? "text-green-600" : trend < 0 ? "text-red-500" : "text-slate-400";

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center", c.icon)}>
            <Icon size={18} className={c.text} />
          </div>
        )}
      </div>

      <div>
        <p className={clsx("text-2xl font-bold tracking-tight", c.text)}>{value}</p>
        {subValue && (
          <p className="text-xs text-slate-400 mt-0.5">{subValue}</p>
        )}
      </div>

      {trend !== undefined && (
        <div className={clsx("flex items-center gap-1 text-xs font-medium", trendColor)}>
          <TrendIcon size={13} />
          <span>
            {trend > 0 ? "+" : ""}{Number(trend).toFixed(1)}% vs last month
          </span>
        </div>
      )}
    </div>
  );
}
