const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment"
    },
    bookingId: {
      type: String,
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer"
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service"
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "INR"
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["UPI", "Card", "Cash", "Pay at Business", "QR Code", "Net Banking"],
      default: "Pay at Business"
    },
    status: {
      type: String,
      enum: ["PENDING", "AUTHORIZED", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING"
    },
    provider: {
      type: String,
      default: "mock-gateway"
    },
    transactionId: {
      type: String,
      default: ""
    },
    notes: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
