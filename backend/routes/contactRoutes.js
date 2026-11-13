const express = require("express");
const mongoose = require("mongoose");
const Contact = require("../models/Contact");
const { protect, adminOnly } = require("../middleware/auth");
const { getBusinessForRequest } = require("../utils/businessContext");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email and message are required." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Your message cannot be saved until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) return res.status(404).json({ message: "Business not found for this shop URL." });
    const contact = await Contact.create({
      business: business._id,
      name,
      email,
      phone: phone || "",
      subject: subject || "General enquiry",
      message
    });

    res.status(201).json({
      message: "Your message has been sent successfully.",
      contact
    });
  } catch (error) {
    console.error("Contact submission error:", error);
    res.status(500).json({ message: "Unable to send your message right now." });
  }
});

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Contact messages cannot be loaded until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const filter = { business: business._id };
    const contacts = await Contact.find(filter).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Error fetching contact messages" });
  }
});

module.exports = router;
