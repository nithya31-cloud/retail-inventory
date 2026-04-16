/**
 * controllers/uploadController.js
 * Handles CSV dataset uploads and bulk product/sales import.
 */
const multer  = require("multer");
const csv     = require("csv-parser");
const fs      = require("fs");
const path    = require("path");
const pool    = require("../config/database");
const logger  = require("../utils/logger");

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits:      { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter:  (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files allowed"), false);
    }
  },
}).single("file");

// ── POST /api/upload/dataset ─────────────────────────────────
const uploadDataset = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const { type = "sales" } = req.body; // "sales" | "products"
    const filePath = req.file.path;
    const rows     = [];

    try {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", row => rows.push(row))
          .on("end", resolve)
          .on("error", reject);
      });

      let inserted = 0, skipped = 0;
      const USD_TO_INR = parseFloat(process.env.USD_TO_INR) || 83.5;

      if (type === "sales") {
        for (const row of rows) {
          try {
            // Auto-detect currency and convert to INR
            let amount = parseFloat(row.total_amount || row.Total || row.amount || 0);
            if (row.currency === "USD" || parseFloat(amount) < 500) {
              amount = amount * USD_TO_INR;
            }

            const [existing] = await pool.query(
              "SELECT id FROM products WHERE sku = ? OR name = ?",
              [row.sku || row.SKU || "", row.product_name || row.Product || ""]
            );
            if (!existing.length) { skipped++; continue; }

            await pool.query(
              `INSERT IGNORE INTO sales
                 (invoice_no, product_id, quantity_sold, unit_price, total_amount, sale_date)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                row.invoice_no || `CSV-${Date.now()}-${inserted}`,
                existing[0].id,
                parseInt(row.quantity || row.Qty || 1),
                parseFloat(row.unit_price || row.Price || 0) * (row.currency === "USD" ? USD_TO_INR : 1),
                amount,
                row.sale_date || row.Date || new Date().toISOString().split("T")[0],
              ]
            );
            inserted++;
          } catch { skipped++; }
        }
      } else if (type === "products") {
        for (const row of rows) {
          try {
            const price = parseFloat(row.unit_price || row.Price || 0) *
              (row.currency === "USD" ? USD_TO_INR : 1);
            const cost  = parseFloat(row.cost_price  || row.Cost  || price * 0.6);

            await pool.query(
              `INSERT IGNORE INTO products
                 (sku, name, unit_price, cost_price, quantity_in_stock, reorder_level)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                row.sku || row.SKU || `AUTO-${Date.now()}`,
                row.name || row.Product || row.product_name || "Unknown",
                price, cost,
                parseInt(row.quantity || row.Stock || 0),
                parseInt(row.reorder_level || 10),
              ]
            );
            inserted++;
          } catch { skipped++; }
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      logger.info(`CSV import: ${inserted} inserted, ${skipped} skipped (type: ${type})`);
      return res.json({
        success:  true,
        message:  `Import complete: ${inserted} records inserted, ${skipped} skipped`,
        inserted, skipped, total: rows.length,
      });
    } catch (parseErr) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      logger.error(`CSV parse error: ${parseErr.message}`);
      return res.status(400).json({ success: false, message: "Failed to parse CSV file" });
    }
  });
};

module.exports = { uploadDataset };
