const express = require("express");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");
const { protect, adminOnly } = require("../middleware/auth");
const { getBusinessForRequest } = require("../utils/businessContext");

const router = express.Router();

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Payments cannot be loaded until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const filter = { business: business._id };
    const payments = await Payment.find(filter).sort({ createdAt: -1 }).populate("appointment");
    res.json(payments);
  } catch (error) {
    console.error("Payment fetch error:", error);
    res.status(500).json({ message: "Error retrieving payment records" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      appointmentId,
      bookingId,
      amount,
      paymentMethod,
      customerId,
      serviceId,
      notes
    } = req.body;

    if (!bookingId || !amount || !paymentMethod) {
      return res.status(400).json({ message: "Booking ID, amount and payment method are required." });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero." });
    }

    const normalizedMethod = paymentMethod.trim();
    const allowed = ["UPI", "Card", "Cash", "Pay at Business", "QR Code", "Net Banking"];
    if (!allowed.includes(normalizedMethod)) {
      return res.status(400).json({ message: "Unsupported payment method." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "The payment was not recorded because MongoDB is disconnected." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) {
      return res.status(404).json({ message: "Business settings not found." });
    }

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      bookingId,
      business: business._id
    }).populate("service");

    if (!appointment || !appointment.service) {
      return res.status(404).json({ message: "Appointment or its service was not found." });
    }

    if (serviceId && String(appointment.service._id) !== String(serviceId)) {
      return res.status(400).json({ message: "The selected service does not match this appointment." });
    }

    if (customerId && String(appointment.customer) !== String(customerId)) {
      return res.status(400).json({ message: "The customer does not match this appointment." });
    }

    const paymentAmount = Number(appointment.servicePrice ?? appointment.service.price);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: "The appointment price is invalid." });
    }
    if (parsedAmount !== paymentAmount) {
      return res.status(409).json({
        message: "The appointment price has changed. Please return to the booking summary and review the current amount."
      });
    }

    const payment = await Payment.create({
      business: business._id,
      appointment: appointment._id,
      bookingId: appointment.bookingId,
      customer: appointment.customer,
      service: appointment.service._id,
      amount: paymentAmount,
      paymentMethod: normalizedMethod,
      provider: "mock-gateway",
      status: normalizedMethod === "Cash" || normalizedMethod === "Pay at Business" ? "PENDING" : "AUTHORIZED",
      notes: notes || "Development mock verification completed successfully."
    });

    await Appointment.findOneAndUpdate(
      { _id: appointment._id, business: business._id },
      { status: "CONFIRMED" }
    );

    res.status(201).json({
      message: "Payment recorded successfully.",
      payment
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    res.status(500).json({ message: "Unable to record this payment." });
  }
});

module.exports = router;
