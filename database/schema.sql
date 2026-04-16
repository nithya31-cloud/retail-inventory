-- ============================================================
-- Retail Inventory Insights - Database Schema
-- Currency: Indian Rupees (INR/₹)
-- ============================================================

CREATE DATABASE IF NOT EXISTS retail_inventory_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE retail_inventory_db;

-- ============================================================
-- USERS / AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin', 'manager', 'viewer') DEFAULT 'viewer',
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  contact_name VARCHAR(100),
  email        VARCHAR(100),
  phone        VARCHAR(20),
  address      TEXT,
  city         VARCHAR(100),
  state        VARCHAR(100),
  pincode      VARCHAR(10),
  lead_time_days INT DEFAULT 7,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  sku                 VARCHAR(50)    NOT NULL UNIQUE,
  name                VARCHAR(200)   NOT NULL,
  description         TEXT,
  category_id         INT,
  supplier_id         INT,
  unit_price          DECIMAL(12,2)  NOT NULL COMMENT 'Price in INR (₹)',
  cost_price          DECIMAL(12,2)  NOT NULL COMMENT 'Cost in INR (₹)',
  quantity_in_stock   INT            NOT NULL DEFAULT 0,
  reorder_level       INT            NOT NULL DEFAULT 10,
  reorder_quantity    INT            NOT NULL DEFAULT 50,
  unit_of_measure     VARCHAR(30)    DEFAULT 'units',
  weight_kg           DECIMAL(8,3),
  is_active           BOOLEAN        DEFAULT TRUE,
  abc_class           ENUM('A','B','C') COMMENT 'ABC Analysis Classification',
  stock_classification ENUM('fast','slow','dead') COMMENT 'Stock movement classification',
  created_at          DATETIME       DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)  ON DELETE SET NULL,
  INDEX idx_sku (sku),
  INDEX idx_category (category_id),
  INDEX idx_stock (quantity_in_stock),
  INDEX idx_abc (abc_class)
) ENGINE=InnoDB;

-- ============================================================
-- SALES TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no      VARCHAR(50)   NOT NULL UNIQUE,
  product_id      INT           NOT NULL,
  quantity_sold   INT           NOT NULL,
  unit_price      DECIMAL(12,2) NOT NULL COMMENT 'Sale price in INR (₹)',
  total_amount    DECIMAL(14,2) NOT NULL COMMENT 'Total in INR (₹)',
  discount_pct    DECIMAL(5,2)  DEFAULT 0.00,
  customer_type   ENUM('retail','wholesale','online') DEFAULT 'retail',
  region          VARCHAR(100),
  city            VARCHAR(100),
  sale_date       DATE          NOT NULL,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product  (product_id),
  INDEX idx_date     (sale_date),
  INDEX idx_invoice  (invoice_no)
) ENGINE=InnoDB;

-- ============================================================
-- INVENTORY TRANSACTIONS (stock in/out audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  product_id      INT           NOT NULL,
  transaction_type ENUM('purchase','sale','adjustment','return','damage') NOT NULL,
  quantity        INT           NOT NULL COMMENT 'positive=in, negative=out',
  unit_cost       DECIMAL(12,2) COMMENT 'Cost per unit in INR (₹)',
  reference_no    VARCHAR(100),
  notes           TEXT,
  created_by      INT,
  transaction_date DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id)  REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)  REFERENCES users(id)    ON DELETE SET NULL,
  INDEX idx_product (product_id),
  INDEX idx_date    (transaction_date)
) ENGINE=InnoDB;

-- ============================================================
-- DEMAND FORECASTS (generated by Python ML models)
-- ============================================================
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  product_id      INT           NOT NULL,
  forecast_date   DATE          NOT NULL,
  predicted_qty   DECIMAL(10,2) NOT NULL,
  lower_bound     DECIMAL(10,2),
  upper_bound     DECIMAL(10,2),
  model_type      VARCHAR(50)   DEFAULT 'linear_regression',
  confidence_pct  DECIMAL(5,2),
  generated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uk_product_date (product_id, forecast_date),
  INDEX idx_product (product_id),
  INDEX idx_date    (forecast_date)
) ENGINE=InnoDB;

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  product_id   INT,
  alert_type   ENUM('low_stock','overstock','dead_stock','high_demand','expiry') NOT NULL,
  severity     ENUM('info','warning','critical') DEFAULT 'warning',
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT FALSE,
  is_resolved  BOOLEAN DEFAULT FALSE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at  DATETIME,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_type    (alert_type),
  INDEX idx_unread  (is_read)
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA — Categories
-- ============================================================
INSERT INTO categories (name, description) VALUES
  ('Electronics',    'Electronic gadgets and accessories'),
  ('Clothing',       'Apparel and fashion items'),
  ('Food & Grocery', 'FMCG and grocery products'),
  ('Home & Kitchen', 'Household and kitchen products'),
  ('Health & Beauty','Health, wellness and personal care'),
  ('Sports',         'Sporting goods and fitness equipment'),
  ('Books',          'Books and stationery'),
  ('Toys',           'Toys and games for children');

-- ============================================================
-- SEED DATA — Suppliers
-- ============================================================
INSERT INTO suppliers (name, contact_name, email, phone, city, state, lead_time_days) VALUES
  ('Reliance Retail Ltd',    'Ramesh Kumar',   'procurement@reliance.com', '9800100001', 'Mumbai',    'Maharashtra', 5),
  ('TATA Consumer Products', 'Priya Nair',     'supply@tata.com',          '9800100002', 'Pune',      'Maharashtra', 7),
  ('Hindustan Unilever',     'Anand Sharma',   'logistics@hul.com',        '9800100003', 'Delhi',     'Delhi',       4),
  ('ITC Limited',            'Kavitha Rajan',  'orders@itc.com',           '9800100004', 'Bengaluru', 'Karnataka',   6),
  ('Wipro Consumer Care',    'Suresh Pillai',  'supply@wipro.com',         '9800100005', 'Chennai',   'Tamil Nadu',  8),
  ('Patanjali Ayurved',      'Vijay Mehta',    'orders@patanjali.com',     '9800100006', 'Haridwar',  'Uttarakhand', 10),
  ('Amazon Seller Services', 'Deepa Krishnan', 'seller@amazon.in',         '9800100007', 'Bengaluru', 'Karnataka',   3);

-- ============================================================
-- SEED DATA — Admin User (password: Admin@1234)
-- ============================================================
INSERT INTO users (username, email, password_hash, role) VALUES
  ('admin', 'admin@retailinsights.in',
   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBpj2lIBNmAeW2',
   'admin');

-- ============================================================
-- VIEWS for Analytics
-- ============================================================

CREATE OR REPLACE VIEW vw_daily_sales AS
  SELECT
    s.sale_date,
    SUM(s.total_amount)  AS revenue_inr,
    SUM(s.quantity_sold) AS units_sold,
    COUNT(DISTINCT s.id) AS transactions,
    p.category_id,
    c.name               AS category_name
  FROM sales s
  JOIN products p ON s.product_id = p.id
  JOIN categories c ON p.category_id = c.id
  GROUP BY s.sale_date, p.category_id, c.name;

CREATE OR REPLACE VIEW vw_product_performance AS
  SELECT
    p.id,
    p.sku,
    p.name,
    p.unit_price,
    p.cost_price,
    p.quantity_in_stock,
    p.reorder_level,
    p.abc_class,
    p.stock_classification,
    c.name                                          AS category,
    COALESCE(SUM(s.total_amount), 0)                AS total_revenue_inr,
    COALESCE(SUM(s.quantity_sold), 0)               AS total_units_sold,
    COALESCE(SUM(s.quantity_sold * p.cost_price), 0) AS total_cost_inr,
    COALESCE(SUM(s.total_amount) - SUM(s.quantity_sold * p.cost_price), 0) AS gross_profit_inr,
    p.quantity_in_stock * p.cost_price              AS inventory_value_inr
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN sales s ON s.product_id = p.id
  WHERE p.is_active = TRUE
  GROUP BY p.id;

CREATE OR REPLACE VIEW vw_low_stock_alerts AS
  SELECT
    p.id, p.sku, p.name, p.quantity_in_stock, p.reorder_level,
    (p.reorder_level - p.quantity_in_stock) AS shortage_qty,
    s.name AS supplier_name,
    s.lead_time_days,
    c.name AS category
  FROM products p
  LEFT JOIN suppliers s  ON p.supplier_id  = s.id
  LEFT JOIN categories c ON p.category_id  = c.id
  WHERE p.quantity_in_stock <= p.reorder_level
    AND p.is_active = TRUE
  ORDER BY (p.reorder_level - p.quantity_in_stock) DESC;

-- ============================================================
-- NOTE: Run backend/src/utils/seeder.js AFTER schema setup
-- to load the 50 real products + 66,206 sales records from CSVs
-- ============================================================
