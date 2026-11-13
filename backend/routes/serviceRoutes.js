const express = require("express");
const mongoose = require("mongoose");
const Service = require("../models/Service");
const { protect, adminOnly } = require("../middleware/auth");
const { getBusinessForRequest } = require("../utils/businessContext");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Services are unavailable because MongoDB is disconnected." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) {
      return res.status(404).json({ message: "Business not found for this shop URL." });
    }

    const services = await Service.find({
      business: business._id,
      isActive: true
    }).sort({ createdAt: -1 });

    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching services" });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Services cannot be saved until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const { name, description, price, duration, category, isActive } = req.body;
    if (!name || !description || !Number.isFinite(Number(price)) || Number(price) < 0 ||
        !Number.isInteger(Number(duration)) || Number(duration) < 1) {
      return res.status(400).json({ message: "Enter a service name, description, non-negative price and valid duration." });
    }

    const service = await Service.create({
      name: String(name).trim(),
      description: String(description).trim(),
      price: Number(price),
      duration: Number(duration),
      category: String(category || "General").trim(),
      isActive: isActive !== false,
      business: business._id
    });

    res.status(201).json({
      message: "Service added successfully",
      service
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating service" });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Services cannot be updated until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const updates = {};
    for (const field of ["name", "description", "price", "duration", "category", "isActive"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }
    if (updates.price !== undefined && (!Number.isFinite(Number(updates.price)) || Number(updates.price) < 0)) {
      return res.status(400).json({ message: "Service price must be a non-negative number." });
    }
    if (updates.duration !== undefined && (!Number.isInteger(Number(updates.duration)) || Number(updates.duration) < 1)) {
      return res.status(400).json({ message: "Service duration must be a positive whole number of minutes." });
    }
    const service = await Service.findOneAndUpdate({ _id: req.params.id, business: business._id }, updates, {
      new: true
      , runValidators: true
    });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({
      message: "Service updated successfully",
      service
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating service" });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Services cannot be deleted until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const service = await Service.findOneAndDelete({ _id: req.params.id, business: business._id });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting service" });
  }
});

module.exports = router;