/**
 * App.jsx - Root application with React Router
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout   from "./components/layout/AppLayout";
import Login       from "./pages/Login";
import Dashboard   from "./pages/Dashboard";
import Inventory   from "./pages/Inventory";
import Analytics   from "./pages/Analytics";
import Forecasting from "./pages/Forecasting";
import Alerts      from "./pages/Alerts";
import Upload      from "./pages/Upload";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index            element={<Dashboard />} />
        <Route path="inventory"   element={<Inventory />} />
        <Route path="analytics"   element={<Analytics />} />
        <Route path="forecasting" element={<Forecasting />} />
        <Route path="alerts"      element={<Alerts />} />
        <Route path="upload"      element={<Upload />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          style: { borderRadius:"12px", background:"#1e293b", color:"#f1f5f9", fontSize:"13px" },
          success: { iconTheme: { primary:"#10b981", secondary:"#f1f5f9" } },
          error:   { iconTheme: { primary:"#ef4444", secondary:"#f1f5f9" } },
        }} />
      </AuthProvider>
    </BrowserRouter>
  );
}
