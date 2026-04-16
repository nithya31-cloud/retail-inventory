/**
 * server.js
 * Main Express application entry point.
 * Retail Inventory Insights - Backend API
 */
require("dotenv").config();

const express     = require("express");
const cors        = require("cors");
const helmet      = require("helmet");
const morgan      = require("morgan");
const rateLimit   = require("express-rate-limit");
const cron        = require("node-cron");
const path        = require("path");

const logger      = require("./utils/logger");
const routes      = require("./routes/index");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security ─────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
}));
app.use("/api/", rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 300,
}));

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── HTTP request logging ─────────────────────────────────────
app.use(morgan("combined", { stream: { write: msg => logger.info(msg.trim()) } }));

// ── Static uploads ───────────────────────────────────────────
app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "./uploads")));

// ── API routes ───────────────────────────────────────────────
app.use("/api", routes);

// ── 404 handler ─────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
);

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ── Scheduled jobs ───────────────────────────────────────────
// Auto-generate alerts every hour
cron.schedule("0 * * * *", async () => {
  try {
    const pool = require("./config/database");
    // Trigger alert generation logic directly
    logger.info("Cron: Checking inventory for alerts...");
    const [lowStock] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM products WHERE is_active=1 AND quantity_in_stock <= reorder_level"
    );
    logger.info(`Cron: ${lowStock[0].cnt} low-stock items found`);
  } catch (err) {
    logger.error(`Cron job failed: ${err.message}`);
  }
});

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Retail Inventory API running on port ${PORT}`);
  logger.info(`   ENV:      ${process.env.NODE_ENV || "development"}`);
  logger.info(`   Docs:     http://localhost:${PORT}/api/health`);
});

module.exports = app;
