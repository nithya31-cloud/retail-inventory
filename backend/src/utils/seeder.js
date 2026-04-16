/**
 * seeder.js
 * Seeds the MySQL database with the real data from CSV files.
 * Usage: node src/utils/seeder.js  (from backend/ directory)
 */
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const pool = require("../config/database");

const DATA_DIR = path.resolve(__dirname, "../../../python-analytics/data");

async function seed() {
  try {
    console.log("\n🌱 Seeding database with real data...\n");

    // ── Products ─────────────────────────────────────────────
    const productsCsv = path.join(DATA_DIR, "products.csv");
    if (!fs.existsSync(productsCsv)) {
      console.error("❌ products.csv not found. Run python-analytics/analytics_engine.py first.");
      process.exit(1);
    }

    const prodLines   = fs.readFileSync(productsCsv, "utf8").trim().split("\n");
    const prodHeaders = prodLines[0].split(",").map(h => h.trim());
    let prodInserted  = 0;

    for (const line of prodLines.slice(1)) {
      const vals = line.split(",");
      const row  = Object.fromEntries(prodHeaders.map((h, i) => [h, (vals[i] || "").trim()]));
      try {
        await pool.query(
          `INSERT INTO products
             (id, sku, name, category_id, supplier_id,
              unit_price, cost_price, quantity_in_stock,
              reorder_level, reorder_quantity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name=VALUES(name), unit_price=VALUES(unit_price),
             cost_price=VALUES(cost_price),
             quantity_in_stock=VALUES(quantity_in_stock)`,
          [
            parseInt(row.id), row.sku, row.name,
            parseInt(row.category_id) || 1,
            parseInt(row.supplier_id) || 1,
            parseFloat(row.unit_price) || 0,
            parseFloat(row.cost_price) || 0,
            parseInt(row.quantity_in_stock) || 0,
            parseInt(row.reorder_level) || 10,
            parseInt(row.reorder_quantity) || 50,
          ]
        );
        prodInserted++;
      } catch (e) {
        // skip
      }
    }
    console.log(`✓ Products seeded: ${prodInserted}`);

    // ── Sales (batch insert for speed) ───────────────────────
    const salesCsv = path.join(DATA_DIR, "sales_history.csv");
    if (!fs.existsSync(salesCsv)) {
      console.log("⚠  sales_history.csv not found. Skipping sales seed.");
    } else {
      const salesLines   = fs.readFileSync(salesCsv, "utf8").trim().split("\n");
      const salesHeaders = salesLines[0].split(",").map(h => h.trim());

      // Insert in batches of 500 for speed
      const BATCH = 500;
      let salesInserted = 0;
      let batch = [];

      const flushBatch = async () => {
        if (!batch.length) return;
        const placeholders = batch.map(() => "(?,?,?,?,?,?,?,?,?,?)").join(",");
        const values = batch.flat();
        try {
          const [res] = await pool.query(
            `INSERT IGNORE INTO sales
               (invoice_no, product_id, quantity_sold, unit_price,
                total_amount, discount_pct, customer_type, region, city, sale_date)
             VALUES ${placeholders}`,
            values
          );
          salesInserted += res.affectedRows;
        } catch {}
        batch = [];
      };

      for (const line of salesLines.slice(1)) {
        const vals = line.split(",");
        const row  = Object.fromEntries(salesHeaders.map((h, i) => [h, (vals[i]||"").trim()]));
        batch.push([
          row.invoice_no, parseInt(row.product_id) || 1,
          parseInt(row.quantity_sold) || 1,
          parseFloat(row.unit_price) || 0,
          parseFloat(row.total_amount) || 0,
          parseFloat(row.discount_pct) || 0,
          row.customer_type || "retail",
          row.region || "India",
          row.city || "Mumbai",
          row.sale_date || "2006-01-01",
        ]);
        if (batch.length >= BATCH) await flushBatch();
      }
      await flushBatch();
      console.log(`✓ Sales seeded: ${salesInserted.toLocaleString()} records`);
    }

    // ── Update ABC and stock classification from analytics ────
    const analyticsPath = path.join(DATA_DIR, "analytics_results.json");
    if (fs.existsSync(analyticsPath)) {
      const analytics = JSON.parse(fs.readFileSync(analyticsPath, "utf8"));

      // Update ABC class on each product
      const abcMap = {};
      for (const item of (analytics.abc_analysis || [])) {
        abcMap[item.product_id] = item.abc_class;
      }
      const scMap = {};
      for (const item of (analytics.stock_classification || [])) {
        scMap[item.product_id] = item.stock_classification;
      }

      let updated = 0;
      for (const [pid, abc] of Object.entries(abcMap)) {
        const sc = scMap[pid] || null;
        try {
          await pool.query(
            "UPDATE products SET abc_class=?, stock_classification=? WHERE id=?",
            [abc, sc, parseInt(pid)]
          );
          updated++;
        } catch {}
      }
      console.log(`✓ ABC + stock classification updated: ${updated} products`);
    }

    console.log("\n✅ Database seeded successfully!");
    console.log("   You can now start the backend: npm run dev\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
