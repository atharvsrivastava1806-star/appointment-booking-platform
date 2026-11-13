const express = require("express");
const mongoose = require("mongoose");
const Review = require("../models/Review");
const { protect, adminOnly } = require("../middleware/auth");
const { getBusinessForRequest } = require("../utils/businessContext");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Reviews are unavailable because MongoDB is disconnected." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) {
      return res.status(404).json({ message: "Business not found for this shop URL." });
    }

    const reviews = await Review.find({
      business: business._id,
      approved: true
    }).sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching reviews" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, location, rating, review: reviewText } = req.body;
    if (!name || !reviewText || !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ message: "Name, a 1–5 star rating, and review text are required." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Reviews cannot be saved until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }

    const review = await Review.create({
      name: String(name).trim(),
      location: String(location || "").trim(),
      rating: Number(rating),
      review: String(reviewText).trim(),
      business: business._id
    });

    res.status(201).json({
      message: "Review submitted successfully. It will be approved by admin.",
      review
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error submitting review" });
  }
});

router.get("/admin", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Reviews cannot be loaded until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });

    const reviews = await Review.find({
      business: business._id
    }).sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching admin reviews" });
  }
});

router.put("/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Reviews cannot be updated until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, business: business._id },
      { $set: { approved: true } },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({
      message: "Review approved successfully",
      review
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error approving review" });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Reviews cannot be deleted until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const review = await Review.findOneAndDelete({ _id: req.params.id, business: business._id });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting review" });
  }
});

module.exports = router;