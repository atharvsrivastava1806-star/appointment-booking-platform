const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    open: { type: String, required: true },
    close: { type: String, required: true }
  },
  { _id: false }
);

const facilitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    icon: { type: String, default: "✦", maxlength: 16 },
    image: { type: String, default: "" }
  },
  { _id: false }
);

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    location: { type: String, default: "", trim: true, maxlength: 100 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true, trim: true, maxlength: 500 },
    isDemo: { type: Boolean, default: true }
  },
  { _id: true }
);

const specialHolidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    reason: { type: String, default: "", trim: true, maxlength: 120 },
    sessions: { type: [sessionSchema], default: undefined }
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      sparse: true
    },
    name: {
      type: String,
      required: true,
      default: "Business Name"
    },
    slug: {
      type: String,
      unique: true,
      default: "business"
    },
    businessType: {
      type: String,
      enum: [
        "salon",
        "barber",
        "spa",
        "gym",
        "clinic",
        "tutor",
        "fitness-trainer",
        "other"
      ],
      default: "other"
    },
    logo: {
      type: String,
      default: "/assets/logo-placeholder.svg"
    },
    heroImage: {
      type: String,
      default: ""
    },
    phone: {
      type: String,
      default: ""
    },
    email: {
      type: String,
      default: ""
    },
    address: {
      type: String,
      default: ""
    },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pinCode: { type: String, default: "" },
    whatsapp: {
      type: String,
      default: ""
    },
    openingHours: {
      type: String,
      default: ""
    },
    closingHours: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default:
        "A premium business dedicated to quality services, expert care, and customer comfort."
    },
    aboutHeading: { type: String, default: "A welcoming experience, tailored to you" },
    aboutDescription: { type: String, default: "" },
    experienceDescription: { type: String, default: "" },
    aboutImage: { type: String, default: "" },
    facilities: { type: [facilitySchema], default: [] },
    testimonials: { type: [testimonialSchema], default: [] },
    settingsInitialized: { type: Boolean, default: false },
    timeZone: { type: String, default: "Asia/Kolkata" },
    workingDays: {
      type: [String],
      enum: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      default: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    },
    weeklyHolidays: {
      type: [String],
      enum: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
      default: ["sunday"]
    },
    weeklySchedule: [
      {
        day: {
          type: String,
          required: true,
          enum: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
        },
        closed: { type: Boolean, default: false },
        sessions: { type: [sessionSchema], default: [] }
      }
    ],
    bookingSlotIntervalMinutes: {
      type: Number,
      enum: [15, 30, 60],
      default: 30
    },
    specialHolidays: { type: [specialHolidaySchema], default: [] },
    websiteColors: {
      primaryColor: {
        type: String,
        default: "#8b5cf6"
      },
      secondaryColor: {
        type: String,
        default: "#f59e0b"
      },
      backgroundColor: {
        type: String,
        default: "#f6f7fb"
      },
      textColor: {
        type: String,
        default: "#101828"
      }
    },
    gallery: [
      {
        title: { type: String },
        description: { type: String },
        image: { type: String }
      }
    ],
    mapLink: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Business", businessSchema);