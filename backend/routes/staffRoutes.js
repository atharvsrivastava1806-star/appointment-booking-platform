const express = require("express");
const mongoose = require("mongoose");
const Staff = require("../models/Staff");
const { protect, adminOnly } = require("../middleware/auth");
const { getBusinessForRequest } = require("../utils/businessContext");
const { DAY_NAMES, parseTime, normalizeDay } = require("../utils/schedule");

const router = express.Router();

const isValidAvailability = (availability) => {
  if (!Array.isArray(availability) || availability.length > 7) return false;
  const days = new Set();
  return availability.every((entry) => {
    const day = normalizeDay(entry?.day);
    if (!day || days.has(day) || (entry.useBusinessHours !== undefined && typeof entry.useBusinessHours !== "boolean") ||
        typeof entry.closed !== "boolean" || !Array.isArray(entry.sessions) || !Array.isArray(entry.slots)) return false;
    days.add(day);
    if (entry.sessions.length > 4 || entry.slots.length > 96) return false;
    if (entry.closed && (entry.sessions.length || entry.slots.length)) return false;
    let previousClose = -1;
    for (const session of entry.sessions) {
      const open = parseTime(session.open);
      const close = parseTime(session.close);
      if (open === null || close === null || open >= close || open < previousClose) return false;
      previousClose = close;
    }
    if (entry.slots.some((slot) => parseTime(slot) === null)) return false;
    if (new Set(entry.slots).size !== entry.slots.length) return false;
    if (entry.useBusinessHours && (entry.sessions.length || entry.slots.length)) return false;
    if (!entry.closed && entry.useBusinessHours !== true && !entry.sessions.length && !entry.slots.length) return false;
    return true;
  });
};

router.get("/", protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Staff information is unavailable because MongoDB is disconnected." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });

    if (!business) {
      return res.status(404).json({ message: "Business not found for this shop URL." });
    }

    const staff = await Staff.find({
      business: business._id,
      isActive: true
    }).populate("services");

    res.json(staff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching staff members" });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Staff cannot be saved until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);

    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const { name, role, services, availability, isActive } = req.body;
    if (!name || !role) return res.status(400).json({ message: "Staff name and role are required." });
    if (availability !== undefined && !isValidAvailability(availability)) {
      return res.status(400).json({ message: "Enter a valid staff schedule with unique days and 24-hour times." });
    }
    const staff = await Staff.create({
      name: String(name).trim(),
      role: String(role).trim(),
      services: Array.isArray(services) ? services : [],
      availability: Array.isArray(availability) ? availability : [],
      isActive: isActive !== false,
      business: business._id
    });

    res.status(201).json({
      message: "Staff member added successfully",
      staff
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating staff member" });
  }
});

router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Staff cannot be updated until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const updates = {};
    for (const field of ["name", "role", "services", "availability", "isActive"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }
    if (updates.availability !== undefined && !isValidAvailability(updates.availability)) {
      return res.status(400).json({ message: "Enter a valid staff schedule with unique days and 24-hour times." });
    }
    const staff = await Staff.findOneAndUpdate({ _id: req.params.id, business: business._id }, updates, {
      new: true
      , runValidators: true
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    res.json({
      message: "Staff member updated successfully",
      staff
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating staff member" });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Staff cannot be deleted until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const staff = await Staff.findOneAndDelete({ _id: req.params.id, business: business._id });

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    res.json({ message: "Staff member deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting staff member" });
  }
});

module.exports = router;