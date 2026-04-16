/**
 * components/layout/Sidebar.jsx
 */
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, BarChart3, TrendingUp,
  Bell, Upload, Settings, LogOut, ShoppingBag,
  AlertTriangle, Boxes
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

const NAV = [
  { to: "/",            icon: LayoutDashboard, label: "Dashboard" },
  { to: "/inventory",   icon: Package,         label: "Inventory" },
  { to: "/analytics",   icon: BarChart3,       label: "Analytics" },
  { to: "/forecasting", icon: TrendingUp,      label: "Forecasting" },
  { to: "/alerts",      icon: Bell,            label: "Alerts",     badge: true },
  { to: "/upload",      icon: Upload,          label: "Import Data" },
];

export default function Sidebar({ alertCount = 0, collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside
      className={clsx(
        "fixed top-0 left-0 h-screen bg-white border-r border-slate-100 flex flex-col z-40 transition-all duration-300",
        collapsed ? "w-16" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100 min-h-[72px]">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Boxes size={20} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-slate-800 text-sm leading-tight">RetailInsights</p>
            <p className="text-xs text-slate-400">Inventory Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-3">
            Main Menu
          </p>
        )}
        {NAV.map(({ to, icon: Icon, label, badge }) => {
          const isActive = location.pathname === to ||
            (to !== "/" && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-blue-700",
                collapsed && "justify-center"
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <span className="flex-1">{label}</span>
              )}
              {!collapsed && badge && alertCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-slate-100">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">
                {user?.username?.charAt(0).toUpperCase() || "A"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">{user?.username}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={clsx(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
            "text-red-500 hover:bg-red-50 transition-all",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={17} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
