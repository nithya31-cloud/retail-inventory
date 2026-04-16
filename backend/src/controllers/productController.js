/**
 * controllers/productController.js
 * Full CRUD for inventory products.
 * All prices stored and returned in INR (₹).
 */
const pool   = require("../config/database");
const logger = require("../utils/logger");

// ── GET /api/products ────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search = "", category_id,
      abc_class, stock_status, sort_by = "name", sort_order = "ASC",
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where    = "WHERE p.is_active = 1";

    if (search) {
      where += " AND (p.name LIKE ? OR p.sku LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category_id) { where += " AND p.category_id = ?"; params.push(category_id); }
    if (abc_class)   { where += " AND p.abc_class = ?";   params.push(abc_class);   }
    if (stock_status === "low")  { where += " AND p.quantity_in_stock <= p.reorder_level"; }
    if (stock_status === "dead") { where += " AND p.stock_classification = 'dead'"; }

    const safeSort  = ["name","sku","unit_price","quantity_in_stock","abc_class"].includes(sort_by) ? sort_by : "name";
    const safeOrder = sort_order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const [products] = await pool.query(
      `SELECT p.id, p.sku, p.name, p.unit_price, p.cost_price,
              p.quantity_in_stock, p.reorder_level, p.reorder_quantity,
              p.abc_class, p.stock_classification,
              p.unit_of_measure, p.is_active,
              c.name AS category, s.name AS supplier,
              (p.quantity_in_stock <= p.reorder_level) AS is_low_stock,
              (p.quantity_in_stock * p.cost_price) AS inventory_value_inr,
              p.updated_at
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers  s ON p.supplier_id  = s.id
       ${where}
       ORDER BY p.${safeSort} ${safeOrder}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p ${where}`,
      params
    );

    return res.json({
      success: true,
      data:    products,
      meta:    { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(`getAll products: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};

// ── GET /api/products/:id ────────────────────────────────────
const getById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category, s.name AS supplier,
              s.contact_name AS supplier_contact, s.phone AS supplier_phone,
              s.lead_time_days,
              (p.quantity_in_stock * p.cost_price) AS inventory_value_inr
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN suppliers  s ON p.supplier_id  = s.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "Product not found" });

    // Recent sales for sparkline
    const [recentSales] = await pool.query(
      `SELECT sale_date, SUM(quantity_sold) AS qty, SUM(total_amount) AS revenue_inr
       FROM sales WHERE product_id = ? AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY sale_date ORDER BY sale_date`,
      [req.params.id]
    );

    return res.json({ success: true, data: { ...rows[0], recent_sales: recentSales } });
  } catch (err) {
    logger.error(`getById product: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
};

// ── POST /api/products ───────────────────────────────────────
const create = async (req, res) => {
  try {
    const {
      sku, name, description, category_id, supplier_id,
      unit_price, cost_price, quantity_in_stock, reorder_level,
      reorder_quantity, unit_of_measure, weight_kg,
    } = req.body;

    if (!sku || !name || !unit_price || !cost_price) {
      return res.status(400).json({ success: false, message: "SKU, name, unit_price, cost_price required" });
    }

    const [result] = await pool.query(
      `INSERT INTO products
         (sku, name, description, category_id, supplier_id,
          unit_price, cost_price, quantity_in_stock, reorder_level,
          reorder_quantity, unit_of_measure, weight_kg)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        sku, name, description || null, category_id || null, supplier_id || null,
        unit_price, cost_price, quantity_in_stock || 0, reorder_level || 10,
        reorder_quantity || 50, unit_of_measure || "units", weight_kg || null,
      ]
    );

    logger.info(`Product created: ${sku} - ${name} by user ${req.user.id}`);
    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data:    { id: result.insertId },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "SKU already exists" });
    }
    logger.error(`create product: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to create product" });
  }
};

// ── PUT /api/products/:id ────────────────────────────────────
const update = async (req, res) => {
  try {
    const fields  = [
      "name","description","category_id","supplier_id",
      "unit_price","cost_price","quantity_in_stock","reorder_level",
      "reorder_quantity","unit_of_measure","weight_kg","is_active",
    ];
    const updates = [];
    const values  = [];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    values.push(req.params.id);
    const [result] = await pool.query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Log inventory transaction if stock changed
    if (req.body.quantity_in_stock !== undefined) {
      await pool.query(
        `INSERT INTO inventory_transactions
           (product_id, transaction_type, quantity, notes, created_by)
         VALUES (?, 'adjustment', ?, 'Manual stock adjustment via admin', ?)`,
        [req.params.id, req.body.quantity_in_stock, req.user.id]
      );
    }

    logger.info(`Product updated: ID ${req.params.id} by user ${req.user.id}`);
    return res.json({ success: true, message: "Product updated successfully" });
  } catch (err) {
    logger.error(`update product: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to update product" });
  }
};

// ── DELETE /api/products/:id (soft delete) ───────────────────
const remove = async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE products SET is_active = 0 WHERE id = ?",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    logger.info(`Product deactivated: ID ${req.params.id} by user ${req.user.id}`);
    return res.json({ success: true, message: "Product removed successfully" });
  } catch (err) {
    logger.error(`delete product: ${err.message}`);
    return res.status(500).json({ success: false, message: "Failed to delete product" });
  }
};

module.exports = { getAll, getById, create, update, remove };
