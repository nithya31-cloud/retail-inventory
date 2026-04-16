/**
 * middleware/auth.js
 * JWT authentication and role-based authorisation middleware.
 */
const jwt    = require("jsonwebtoken");
const pool   = require("../config/database");
const logger = require("../utils/logger");

/**
 * Verifies JWT token from Authorization header.
 * Attaches decoded user payload to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Access token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_dev_secret");

    // Attach user info to request
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired. Please login again." });
    }
    logger.warn(`Auth failure: ${err.message}`);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

/**
 * Role-based access control factory.
 * Usage: authorise("admin") or authorise("admin", "manager")
 */
const authorise = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(" or ")}`,
    });
  }
  next();
};

module.exports = { authenticate, authorise };
