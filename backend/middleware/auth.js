const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { getJwtSecret } = require("../config/jwt");

const JWT_SECRET = getJwtSecret();

const optionalAuth = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) return next();

  try {
    const decoded = jwt.verify(authorization.split(" ")[1], JWT_SECRET);
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Authentication is unavailable because the database is disconnected." });
    }

    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ message: "User not found" });
    if (Number(decoded.tokenVersion || 0) !== Number(req.user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Token invalid or expired" });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Authentication is unavailable because the database is disconnected." });
    }

    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }
    if (Number(decoded.tokenVersion || 0) !== Number(req.user.tokenVersion || 0)) {
      return res.status(401).json({ message: "Token invalid or expired" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({ message: "Access denied. Admin only." });
};

module.exports = { protect, optionalAuth, adminOnly };