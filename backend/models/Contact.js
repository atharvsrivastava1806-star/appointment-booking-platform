const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business"
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      default: ""
    },
    subject: {
      type: String,
      default: ""
    },
    message: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["new", "replied"],
      default: "new"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
