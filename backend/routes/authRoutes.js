const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Business = require("../models/Business");
const { initializeBusinessSettings } = require("../utils/businessDefaults");
const { protect } = require("../middleware/auth");
const { getJwtSecret } = require("../config/jwt");

const router = express.Router();
const JWT_SECRET = getJwtSecret();

router.post("/customer/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Customer accounts are unavailable until the database is connected." });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "customer"
    });
    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.status(201).json({
      message: "Customer account created.",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.error("Customer registration error:", error);
    return res.status(500).json({ message: "Unable to create customer account." });
  }
});

router.post("/customer/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Customer sign-in is unavailable until the database is connected." });
    }
    const user = await User.findOne({ email, role: "customer" });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid customer credentials." });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.json({
      message: "Login successful.",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Customer login error:", error);
    return res.status(500).json({ message: "Unable to sign in right now." });
  }
});

router.post("/register", async (req, res) => {
  let user;
  let business;
  try {
    const name = String(req.body.name || "").trim();
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    if (name.length > 80) {
      return res.status(400).json({ message: "Name must be 80 characters or fewer." });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Salon owner registration is unavailable until the database is connected." });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    user = await User.create({
      name,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      role: "admin"
    });

    const baseSlug = normalizedEmail.split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "business";
    let slug = baseSlug;
    let suffix = 2;
    while (await Business.exists({ slug })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    business = await Business.create({
      owner: user._id,
      slug,
      name: `${name}'s Business`
    });
    await initializeBusinessSettings(business);
    user.business = business._id;
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful.",
      token,
      business: { id: business._id, slug: business.slug },
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (business?._id) await Business.findByIdAndDelete(business._id).catch((cleanupError) => {
      console.error("Unable to remove incomplete owner business:", cleanupError);
    });
    if (user?._id) await User.findByIdAndDelete(user._id).catch((cleanupError) => {
      console.error("Unable to remove incomplete owner account:", cleanupError);
    });
    console.error("Register error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account or business with these details already exists." });
    }
    return res.status(500).json({ message: "Unable to create salon owner account." });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Salon owner sign-in is unavailable until the database is connected." });
    }
    const user = await User.findOne({ email, role: "admin" });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id || user.id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login" });
  }
});

router.get("/me", protect, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

router.patch("/me", protect, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ message: "Only customer accounts can update profile details here." });
  }

  const name = String(req.body.name || "").trim();
  if (!name || name.length > 80) {
    return res.status(400).json({ message: "Enter a profile name with 1 to 80 characters." });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name } },
      { new: true, runValidators: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "Customer account not found." });
    return res.json({
      message: "Profile updated.",
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Customer profile update error:", error);
    return res.status(500).json({ message: "Unable to update profile." });
  }
});

router.post("/logout", protect, async (req, res) => {
  if (mongoose.connection.readyState !== 1 || !req.user._id) {
    return res.status(503).json({ message: "Server-side token revocation is unavailable." });
  }

  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    return res.json({ message: "Signed out and token revoked." });
  } catch (error) {
    console.error("Logout token revocation error:", error);
    return res.status(500).json({ message: "Unable to revoke the sign-in token." });
  }
});

module.exports = router;