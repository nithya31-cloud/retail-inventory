/**
 * pages/Forecasting.jsx
 * Demand forecasting visualisation with confidence bands.
 */
import { useEffect, useState } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { analyticsApi, fmt } from "../utils/api";
import { TrendingUp, Brain } from "lucide-react";

export default function Forecasting() {
  const [forecasts, setForecasts] = useState({});
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    analyticsApi.forecasts().then(res => {
      const data = res.data.data || {};
      setForecasts(data);
      const firstKey = Object.keys(data)[0];
      if (firstKey) setSelected(firstKey);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selectedForecast = forecasts[selected];

  // Build chart data: forecasts array
  const chartData = (selectedForecast?.forecasts || []).map((f, i) => ({
    date:      f.date,
    predicted: f.predicted,
    lower:     f.lower_bound,
    upper:     f.upper_bound,
    label:     `Day ${i + 1}`,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Brain size={24} className="text-blue-500" />
          Demand Forecasting
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Polynomial Linear Regression forecasts — next 30 days
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          Loading forecasts…
        </div>
      ) : (
        <>
          {/* Product selector */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(forecasts).map(([pid, f]) => (
              <button
                key={pid}
                onClick={() => setSelected(pid)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  selected === pid
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                }`}
              >
                {pid === "1" ? "Aashirvaad Atta" : pid === "3" ? "MI 43 LED TV" : pid === "6" ? "HP Laptop" : pid === "11" ? "Nescafe Classic" : pid === "21" ? "Fortune Oil" : `Product #${pid}`}
              </button>
            ))}
          </div>

          {selectedForecast && !selectedForecast.error && (
            <div className="space-y-4">
              {/* Model info cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Model",           value: "Polynomial LR", color: "text-blue-600" },
                  { label: "Confidence",       value: fmt.pct(selectedForecast.confidence_pct), color: "text-green-600" },
                  { label: "MAE",             value: `${selectedForecast.mae} units`, color: "text-amber-600" },
                  { label: "30-Day Forecast", value: `${fmt.num(selectedForecast.total_forecast_qty)} units`, color: "text-purple-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card p-4">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Forecast chart */}
              <div className="card p-5">
                <h2 className="font-semibold text-slate-700 mb-4">
                  Demand Forecast — Next 30 Days (with confidence bands)
                </h2>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickFormatter={v => v?.slice(5)}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      label={{ value: "Units", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                      formatter={(v, n) => [Number(v).toFixed(1), n]}
                    />
                    <Legend />
                    {/* Confidence band */}
                    <Area
                      type="monotone"
                      dataKey="upper"
                      name="Upper bound"
                      fill="#dbeafe"
                      stroke="transparent"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="lower"
                      name="Lower bound"
                      fill="#ffffff"
                      stroke="transparent"
                      fillOpacity={1}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted demand"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: "#3b82f6" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Shaded area = confidence interval (±MAE = ±{selectedForecast.mae} units)
                </p>
              </div>

              {/* Forecast table */}
              <div className="card p-5 overflow-x-auto">
                <h2 className="font-semibold text-slate-700 mb-3">Forecast Detail Table</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Predicted (units)</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Lower Bound</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Upper Bound</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedForecast.forecasts || []).map((f, i) => (
                      <tr key={i} className="table-row">
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{f.date}</td>
                        <td className="px-3 py-2 font-semibold text-blue-600">{f.predicted}</td>
                        <td className="px-3 py-2 text-slate-500">{f.lower_bound}</td>
                        <td className="px-3 py-2 text-slate-500">{f.upper_bound}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedForecast?.error && (
            <div className="card p-8 text-center text-slate-400">
              <p>{selectedForecast.error}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
