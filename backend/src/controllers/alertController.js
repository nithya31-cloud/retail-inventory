/**
 * controllers/alertController.js
 * Manages inventory alerts: low stock, overstock, dead stock, high demand.
 */
const pool   = require("../config/database");
const logger = require("../utils/logger");

// ── GET /api/alerts ──────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { is_read, type, limit = 50 } = req.query;
    let where = "WHERE 1=1";
    const params = [];

    if (is_read !== undefined) { where += " AND a.is_read = ?"; params.push(is_read === "true" ? 1 : 0); }
    if (type)    { where += " AND a.alert_type = ?"; params.push(type); }

    const [alerts] = await pool.query(
      `SELECT a.*, p.name AS product_name, p.sku
       FROM alerts a
       LEFT JOIN products p ON a.product_id = p.id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ success: true, data: alerts });
  } catch (err) {
    logger.error(`getAlerts: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch alerts" });
  }
};

// ── PUT /api/alerts/:id/read ─────────────────────────────────
const markRead = async (req, res) => {
  try {
    await pool.query("UPDATE alerts SET is_read = 1 WHERE id = ?", [req.params.id]);
    return res.json({ success: true, message: "Alert marked as read" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to update alert" });
  }
};

// ── POST /api/alerts/generate ────────────────────────────────
// Scans inventory and auto-generates alerts based on rules
const generateAlerts = async (req, res) => {
  try {
    let created = 0;

    // 1. Low stock alerts
    const [lowStock] = await pool.query(`
      SELECT id, name, quantity_in_stock, reorder_level
      FROM products
      WHERE is_active = 1 AND quantity_in_stock <= reorder_level
    `);
    for (const p of lowStock) {
      // Avoid duplicate unresolved alerts
      const [[{ cnt }]] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM alerts WHERE product_id = ? AND alert_type = 'low_stock' AND is_resolved = 0",
        [p.id]
      );
      if (cnt === 0) {
        const severity = p.quantity_in_stock === 0 ? "critical" : "warning";
        await pool.query(
          `INSERT INTO alerts (product_id, alert_type, severity, message)
           VALUES (?, 'low_stock', ?, ?)`,
          [p.id, severity,
           `${p.name}: Only ${p.quantity_in_stock} units left (reorder level: ${p.reorder_level})`]
        );
        created++;
      }
    }

    // 2. Overstock alerts (quantity > 5× reorder_level)
    const [overstock] = await pool.query(`
      SELECT id, name, quantity_in_stock, reorder_level
      FROM products
      WHERE is_active = 1 AND quantity_in_stock > reorder_level * 5
    `);
    for (const p of overstock) {
      const [[{ cnt }]] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM alerts WHERE product_id = ? AND alert_type = 'overstock' AND is_resolved = 0",
        [p.id]
      );
      if (cnt === 0) {
        await pool.query(
          `INSERT INTO alerts (product_id, alert_type, severity, message)
           VALUES (?, 'overstock', 'info', ?)`,
          [p.id, `${p.name}: Overstock detected (${p.quantity_in_stock} units, 5× above reorder level)`]
        );
        created++;
      }
    }

    logger.info(`Generated ${created} new alerts`);
    return res.json({ success: true, message: `Generated ${created} new alerts`, created });
  } catch (err) {
    logger.error(`generateAlerts: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to generate alerts" });
  }
};

// ── GET /api/alerts/summary ──────────────────────────────────
const getSummary = async (req, res) => {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*)                                          AS total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END)    AS unread,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN severity = 'warning'  THEN 1 ELSE 0 END) AS warning,
        SUM(CASE WHEN alert_type = 'low_stock' THEN 1 ELSE 0 END) AS low_stock
      FROM alerts
      WHERE is_resolved = 0
    `);
    return res.json({ success: true, data: summary });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed" });
  }
};

module.exports = { getAll, markRead, generateAlerts, getSummary };
