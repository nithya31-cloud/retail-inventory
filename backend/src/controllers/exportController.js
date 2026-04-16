/**
 * controllers/exportController.js
 * Exports inventory data and reports as CSV / PDF.
 */
const pool   = require("../config/database");
const logger = require("../utils/logger");

// ── GET /api/export/products/csv ─────────────────────────────
const exportProductsCsv = async (req, res) => {
  try {
    const [products] = await pool.query(`
      SELECT p.sku, p.name, c.name AS category, s.name AS supplier,
             p.unit_price, p.cost_price, p.quantity_in_stock,
             p.reorder_level, p.abc_class, p.stock_classification,
             (p.quantity_in_stock * p.cost_price) AS inventory_value_inr
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers  s ON p.supplier_id  = s.id
      WHERE p.is_active = 1
      ORDER BY p.name
    `);

    const headers = Object.keys(products[0] || {});
    const csvRows = [
      headers.join(","),
      ...products.map(row =>
        headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=products_${Date.now()}.csv`);
    return res.send(csvRows.join("\n"));
  } catch (err) {
    logger.error(`exportProductsCsv: ${err.message}`);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};

// ── GET /api/export/sales/csv ─────────────────────────────────
const exportSalesCsv = async (req, res) => {
  try {
    const { from, to } = req.query;
    let where = "";
    const params = [];
    if (from) { where += " AND s.sale_date >= ?"; params.push(from); }
    if (to)   { where += " AND s.sale_date <= ?"; params.push(to);   }

    const [sales] = await pool.query(
      `SELECT s.invoice_no, p.sku, p.name AS product,
              s.quantity_sold, s.unit_price, s.total_amount,
              s.discount_pct, s.customer_type, s.region, s.city, s.sale_date
       FROM sales s
       JOIN products p ON s.product_id = p.id
       WHERE 1=1 ${where}
       ORDER BY s.sale_date DESC`,
      params
    );

    const headers = Object.keys(sales[0] || {});
    const csvRows = [
      headers.join(","),
      ...sales.map(row =>
        headers.map(h => `"${String(row[h] ?? "")}"`).join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=sales_${Date.now()}.csv`);
    return res.send(csvRows.join("\n"));
  } catch (err) {
    logger.error(`exportSalesCsv: ${err.message}`);
    return res.status(500).json({ success: false, message: "Export failed" });
  }
};

// ── GET /api/export/report/pdf ────────────────────────────────
const exportReportPdf = async (req, res) => {
  try {
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=inventory_report_${Date.now()}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(22).font("Helvetica-Bold").text("Retail Inventory Insights", { align: "center" });
    doc.fontSize(12).font("Helvetica").text(`Report Generated: ${new Date().toLocaleString("en-IN")}`, { align: "center" });
    doc.moveDown(2);

    // KPIs
    const [[kpis]] = await pool.query(`
      SELECT
        ROUND(SUM(s.total_amount), 2)                     AS total_revenue,
        ROUND(SUM(p.quantity_in_stock * p.cost_price), 2) AS inventory_value,
        SUM(CASE WHEN p.quantity_in_stock <= p.reorder_level THEN 1 ELSE 0 END) AS low_stock
      FROM products p LEFT JOIN sales s ON s.product_id = p.id WHERE p.is_active = 1
    `);

    doc.fontSize(16).font("Helvetica-Bold").text("Key Performance Indicators");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica");
    doc.text(`Total Revenue:        ₹${Number(kpis.total_revenue || 0).toLocaleString("en-IN")}`);
    doc.text(`Inventory Value:      ₹${Number(kpis.inventory_value || 0).toLocaleString("en-IN")}`);
    doc.text(`Low Stock Items:      ${kpis.low_stock}`);
    doc.moveDown(1.5);

    // Top 10 Products
    const [topProducts] = await pool.query(`
      SELECT p.name, ROUND(SUM(s.total_amount), 2) AS revenue,
             SUM(s.quantity_sold) AS units
      FROM sales s JOIN products p ON s.product_id = p.id
      GROUP BY p.id ORDER BY revenue DESC LIMIT 10
    `);

    doc.fontSize(16).font("Helvetica-Bold").text("Top 10 Products by Revenue");
    doc.moveDown(0.5);

    // Table header
    const cols = [30, 280, 420, 500];
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Rank", cols[0], doc.y, { continued: true, width: 40 });
    doc.text("Product",  cols[1], doc.y - doc.currentLineHeight(), { continued: true, width: 200 });
    doc.text("Revenue (₹)", cols[2], doc.y - doc.currentLineHeight(), { continued: true, width: 100 });
    doc.text("Units", cols[3], doc.y - doc.currentLineHeight());
    doc.moveDown(0.3);
    doc.moveTo(30, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(10);
    topProducts.forEach((p, i) => {
      const y = doc.y;
      doc.text(`${i + 1}`, cols[0], y, { width: 30 });
      doc.text(p.name.substring(0, 32), cols[1], y, { width: 200 });
      doc.text(`₹${Number(p.revenue).toLocaleString("en-IN")}`, cols[2], y, { width: 100 });
      doc.text(`${p.units}`, cols[3], y);
      doc.moveDown(0.5);
    });

    doc.moveDown(1);

    // Low Stock
    const [lowStock] = await pool.query(`
      SELECT name, quantity_in_stock, reorder_level
      FROM products WHERE is_active = 1 AND quantity_in_stock <= reorder_level
      ORDER BY quantity_in_stock LIMIT 15
    `);

    doc.fontSize(16).font("Helvetica-Bold").text("Low Stock Alerts");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    lowStock.forEach(p => {
      doc.text(`• ${p.name}: ${p.quantity_in_stock} units (reorder at ${p.reorder_level})`);
    });

    doc.end();
  } catch (err) {
    logger.error(`exportReportPdf: ${err.message}`);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "PDF generation failed" });
    }
  }
};

module.exports = { exportProductsCsv, exportSalesCsv, exportReportPdf };
