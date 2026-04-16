/**
 * controllers/categoryController.js
 */
const pool = require("../config/database");

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.description,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       GROUP BY c.id ORDER BY c.name`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

const getSuppliers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, contact_name, email, phone, city, state, lead_time_days
       FROM suppliers WHERE is_active = 1 ORDER BY name`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch suppliers" });
  }
};

module.exports = { getAll, getSuppliers };
