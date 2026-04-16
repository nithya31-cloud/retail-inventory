/**
 * controllers/authController.js
 * Handles user authentication: login, logout, profile.
 */
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const pool   = require("../config/database");
const logger = require("../utils/logger");

const JWT_SECRET  = process.env.JWT_SECRET  || "fallback_dev_secret_change_in_prod";
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

// ── POST /api/auth/login ─────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const [rows] = await pool.query(
      "SELECT id, username, email, password_hash, role, is_active FROM users WHERE email = ?",
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Account is deactivated" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Update last login
    await pool.query("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);

    const payload = {
      id:       user.id,
      username: user.username,
      email:    user.email,
      role:     user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    logger.info(`User logged in: ${user.email} (${user.role})`);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: payload,
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── GET /api/auth/profile ────────────────────────────────────
const profile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, email, role, last_login, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error(`Profile error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ── POST /api/auth/change-password ──────────────────────────
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: "Both passwords required" });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const [rows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ?",
      [req.user.id]
    );
    const isValid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Current password incorrect" });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.user.id]);

    logger.info(`Password changed for user ID: ${req.user.id}`);
    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    logger.error(`Change password error: ${err.message}`);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { login, profile, changePassword };
