require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const businessRoutes = require("./routes/businessRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const staffRoutes = require("./routes/staffRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const contactRoutes = require("./routes/contactRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/payments", paymentRoutes);

app.use(express.static(path.join(__dirname, "../frontend")));

const shopPageFiles = {
  home: "index.html",
  about: "about.html",
  services: "services.html",
  contact: "contact.html",
  booking: "booking.html",
  login: "login.html",
  "salon-owner-login": "salon-owner-login.html",
  "my-bookings": "my-bookings.html",
  "payment-summary": "payment-summary.html",
  payment: "payment.html",
  "payment-success": "payment-success.html"
};

app.get("/shop/:businessSlug/:page?", (req, res, next) => {
  const page = req.params.page || "home";
  const pageName = page.replace(/\.html$/, "");
  const fileName = shopPageFiles[pageName];
  if (!fileName || !/^[a-z0-9-]+$/i.test(req.params.businessSlug)) return next();
  res.sendFile(path.join(__dirname, "../frontend", fileName));
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.get("*", (req, res) => {
  const filePath = path.join(__dirname, "../frontend", req.path.replace(/^\//, ""));
  if (filePath.includes("..")) {
    return res.status(400).send("Invalid path");
  }
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, "../frontend/index.html"));
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});