const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true
    },
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
      }
    ],
    availability: [
      {
        day: {
          type: String,
          enum: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        },
        slots: [String],
        sessions: [
          {
            open: String,
            close: String
          }
        ],
        useBusinessHours: Boolean,
        closed: { type: Boolean, default: false }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    isDemo: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Staff", staffSchema);