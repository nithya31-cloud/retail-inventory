/**
 * routes/index.js
 * Central route registry — all API endpoints.
 */
const express   = require("express");
const router    = express.Router();
const { authenticate, authorise } = require("../middleware/auth");

// Controllers
const authCtrl       = require("../controllers/authController");
const productCtrl    = require("../controllers/productController");
const analyticsCtrl  = require("../controllers/analyticsController");
const alertCtrl      = require("../controllers/alertController");
const uploadCtrl     = require("../controllers/uploadController");
const exportCtrl     = require("../controllers/exportController");

// ── Health check ─────────────────────────────────────────────
router.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString(), version: "1.0.0" })
);

// ── Auth ─────────────────────────────────────────────────────
router.post("/auth/login",            authCtrl.login);
router.get ("/auth/profile",          authenticate, authCtrl.profile);
router.put ("/auth/change-password",  authenticate, authCtrl.changePassword);

// ── Products (CRUD) ──────────────────────────────────────────
router.get ("/products",      authenticate, productCtrl.getAll);
router.get ("/products/:id",  authenticate, productCtrl.getById);
router.post("/products",      authenticate, authorise("admin","manager"), productCtrl.create);
router.put ("/products/:id",  authenticate, authorise("admin","manager"), productCtrl.update);
router.delete("/products/:id",authenticate, authorise("admin"),           productCtrl.remove);

// ── Categories & Suppliers ───────────────────────────────────
const catCtrl = require("../controllers/categoryController");
router.get("/categories",     authenticate, catCtrl.getAll);
router.get("/suppliers",      authenticate, catCtrl.getSuppliers);

// ── Analytics ────────────────────────────────────────────────
router.get ("/analytics/kpis",                  authenticate, analyticsCtrl.getKpis);
router.get ("/analytics/abc",                   authenticate, analyticsCtrl.getAbc);
router.get ("/analytics/trends",                authenticate, analyticsCtrl.getTrends);
router.get ("/analytics/dos",                   authenticate, analyticsCtrl.getDaysOfSupply);
router.get ("/analytics/forecasts",             authenticate, analyticsCtrl.getForecasts);
router.get ("/analytics/recommendations",       authenticate, analyticsCtrl.getRecommendations);
router.get ("/analytics/category-distribution", authenticate, analyticsCtrl.getCategoryDistribution);
router.get ("/analytics/stock-classification",  authenticate, analyticsCtrl.getStockClassification);
router.post("/analytics/refresh",               authenticate, authorise("admin"), analyticsCtrl.refreshAnalytics);

// ── Alerts ───────────────────────────────────────────────────
router.get ("/alerts",                authenticate, alertCtrl.getAll);
router.get ("/alerts/summary",        authenticate, alertCtrl.getSummary);
router.put ("/alerts/:id/read",       authenticate, alertCtrl.markRead);
router.post("/alerts/generate",       authenticate, authorise("admin","manager"), alertCtrl.generateAlerts);

// ── Upload (CSV dataset) ─────────────────────────────────────
router.post("/upload/dataset",        authenticate, authorise("admin"), uploadCtrl.uploadDataset);

// ── Export ───────────────────────────────────────────────────
router.get ("/export/products/csv",   authenticate, exportCtrl.exportProductsCsv);
router.get ("/export/sales/csv",      authenticate, exportCtrl.exportSalesCsv);
router.get ("/export/report/pdf",     authenticate, exportCtrl.exportReportPdf);

module.exports = router;
