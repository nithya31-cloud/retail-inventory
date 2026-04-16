/**
 * config/database.js
 * MySQL connection pool using mysql2/promise
 */
const mysql  = require("mysql2/promise");
const logger = require("../utils/logger");

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  database:           process.env.DB_NAME     || "retail_inventory_db",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0,
  charset:            "utf8mb4",
});

// Verify connection on startup
pool.getConnection()
  .then(conn => {
    logger.info("✓ MySQL connected successfully");
    conn.release();
  })
  .catch(err => {
    logger.error("✗ MySQL connection failed:", err.message);
    // Don't crash — let the app start with mock data fallback
  });

module.exports = pool;
