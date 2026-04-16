/**
 * components/layout/AppLayout.jsx
 */
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Menu, RefreshCw, Bell, Search } from "lucide-react";
import { alertsApi } from "../../utils/api";
import clsx from "clsx";

export default function AppLayout() {
  const [collapsed,   setCollapsed]   = useState(false);
  const [alertCount,  setAlertCount]  = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    const fetchAlertCount = async () => {
      try {
        const res = await alertsApi.getSummary();
        setAlertCount(res.data.data?.unread || 0);
      } catch { /* silent */ }
    };
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 60_000); // every 60s
    return () => clearInterval(interval);
  }, []);

  const sidebarW = collapsed ? 64 : 260;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        alertCount={alertCount}
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
      />

      {/* Main content */}
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarW }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-100 px-6 py-3.5 flex items-center gap-4">
          <button
            onClick={() => setCollapsed(p => !p)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 flex items-center gap-2 max-w-sm">
            <Search size={15} className="text-slate-400" />
            <input
              placeholder="Search products, SKUs…"
              className="text-sm bg-transparent focus:outline-none text-slate-600 placeholder-slate-400 w-full"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-slate-400 hidden md:block">
              Last updated {lastRefresh.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}
            </span>
            <button
              onClick={() => setLastRefresh(new Date())}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
            <button className="relative p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <Bell size={18} />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
