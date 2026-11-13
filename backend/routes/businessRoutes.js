const express = require("express");
const mongoose = require("mongoose");
const Business = require("../models/Business");
const { protect, adminOnly } = require("../middleware/auth");
const { getBusinessForRequest } = require("../utils/businessContext");
const { initializeBusinessSettings } = require("../utils/businessDefaults");
const { DAY_NAMES, parseTime } = require("../utils/schedule");

const router = express.Router();
const businessTypes = ["salon", "barber", "spa", "gym", "clinic", "tutor", "fitness-trainer", "other"];
const validString = (value, maxLength, field, { required = false } = {}) => {
  if (typeof value !== "string") return `${field} must be text.`;
  if (required && !value.trim()) return `${field} is required.`;
  if (value.length > maxLength) return `${field} must be no more than ${maxLength} characters.`;
  return "";
};

const isValidImage = (value) => {
  if (!value) return true;
  if (typeof value !== "string" || value.length > 1_000_000) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const validateSessions = (sessions, label) => {
  if (!Array.isArray(sessions) || sessions.length > 4) return `${label} must have up to four sessions.`;
  let previousClose = -1;
  for (const [index, session] of sessions.entries()) {
    if (!session || parseTime(session.open) === null || parseTime(session.close) === null) {
      return `${label} session ${index + 1} must use 24-hour HH:mm times.`;
    }
    const open = parseTime(session.open);
    const close = parseTime(session.close);
    if (open >= close || open < previousClose) return `${label} sessions must be ordered and must not overlap.`;
    previousClose = close;
  }
  return "";
};

const validateSettings = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Settings must be sent as an object.";
  const stringLimits = {
    name: 120,
    phone: 40,
    whatsapp: 40,
    email: 254,
    address: 300,
    city: 100,
    state: 100,
    pinCode: 20,
    mapLink: 500,
    description: 5000,
    aboutHeading: 160,
    aboutDescription: 5000,
    experienceDescription: 5000,
    openingHours: 120,
    closingHours: 120,
    timeZone: 100
  };
  for (const [field, maxLength] of Object.entries(stringLimits)) {
    if (body[field] === undefined) continue;
    const error = validString(body[field], maxLength, field, { required: field === "name" });
    if (error) return error;
  }

  if (body.businessType !== undefined && !businessTypes.includes(body.businessType)) {
    return "Choose a valid business category.";
  }
  if (body.bookingSlotIntervalMinutes !== undefined &&
      ![15, 30, 60].includes(Number(body.bookingSlotIntervalMinutes))) {
    return "Appointment start interval must be 15, 30, or 60 minutes.";
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return "Enter a valid email address.";
  if (body.pinCode && !/^[A-Za-z0-9 -]{3,20}$/.test(body.pinCode)) return "Enter a valid PIN or postal code.";
  if (body.mapLink) {
    try {
      const mapUrl = new URL(body.mapLink);
      if (!["https:", "http:"].includes(mapUrl.protocol)) return "The map link must be an HTTP or HTTPS URL.";
    } catch {
      return "Enter a valid map link.";
    }
  }
  if (body.timeZone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timeZone });
    } catch {
      return "Choose a valid time zone.";
    }
  }
  for (const field of ["logo", "heroImage", "aboutImage"]) {
    if (body[field] !== undefined && !isValidImage(body[field])) return `${field} must be a URL or an image under 1 MB.`;
  }

  if (body.weeklySchedule !== undefined) {
    if (!Array.isArray(body.weeklySchedule) || body.weeklySchedule.length !== 7) {
      return "Set a schedule for all seven days.";
    }
    const days = new Set();
    for (const entry of body.weeklySchedule) {
      if (!entry || !DAY_NAMES.includes(entry.day) || days.has(entry.day)) return "Each day must appear once in the weekly schedule.";
      days.add(entry.day);
      if (typeof entry.closed !== "boolean") return "Choose whether each day is open or closed.";
      const error = validateSessions(entry.sessions, entry.day);
      if (error) return error;
      if (entry.closed && entry.sessions.length) return `${entry.day} cannot have sessions when marked closed.`;
      if (!entry.closed && !entry.sessions.length) return `${entry.day} needs at least one session or must be marked closed.`;
    }
  }

  for (const field of ["workingDays", "weeklyHolidays"]) {
    if (body[field] !== undefined &&
        (!Array.isArray(body[field]) || body[field].some((day) => !DAY_NAMES.includes(day)))) {
      return `${field} must contain valid weekdays.`;
    }
  }
  if (body.specialHolidays !== undefined) {
    if (!Array.isArray(body.specialHolidays) || body.specialHolidays.length > 100) return "Special holidays must be a list of up to 100 dates.";
    const holidayDates = new Set();
    for (const holiday of body.specialHolidays) {
      const parsedDate = typeof holiday?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(holiday.date)
        ? new Date(`${holiday.date}T00:00:00Z`)
        : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== holiday.date) {
        return "Each special holiday needs a valid YYYY-MM-DD date.";
      }
      if (holidayDates.has(holiday.date)) return "Each special holiday date may only be listed once.";
      holidayDates.add(holiday.date);
      if (holiday.reason && (typeof holiday.reason !== "string" || holiday.reason.length > 120)) return "Holiday reasons must be 120 characters or fewer.";
      if (holiday.sessions !== undefined) {
        const error = validateSessions(holiday.sessions, `Holiday ${holiday.date}`);
        if (error) return error;
      }
    }
  }

  if (body.facilities !== undefined) {
    if (!Array.isArray(body.facilities) || body.facilities.length > 20) return "Facilities must be a list of up to 20 items.";
    for (const facility of body.facilities) {
      if (!facility || validString(facility.title, 100, "Facility title", { required: true }) ||
          validString(facility.description || "", 500, "Facility description") ||
          validString(facility.icon || "✦", 16, "Facility icon") ||
          !isValidImage(facility.image || "")) return "Each facility needs a title, description, icon, and valid image.";
    }
  }

  if (body.testimonials !== undefined) {
    if (!Array.isArray(body.testimonials) || body.testimonials.length > 20) return "Testimonials must be a list of up to 20 items.";
    for (const testimonial of body.testimonials) {
      if (!testimonial ||
          validString(testimonial.name, 80, "Testimonial name", { required: true }) ||
          validString(testimonial.location || "", 100, "Testimonial location") ||
          validString(testimonial.review, 500, "Testimonial text", { required: true }) ||
          !Number.isInteger(Number(testimonial.rating)) || Number(testimonial.rating) < 1 || Number(testimonial.rating) > 5 ||
          testimonial.isDemo !== true) return "Each manual testimonial must have a name, location, 1–5 star rating, review, and sample status.";
    }
  }
  return "";
};

const allowedFields = [
  "name", "businessType", "logo", "heroImage", "phone", "email", "address", "city",
  "state", "pinCode", "whatsapp", "openingHours", "closingHours", "description",
  "aboutHeading", "aboutDescription", "experienceDescription", "aboutImage", "facilities",
  "testimonials", "timeZone", "workingDays", "weeklyHolidays", "weeklySchedule",
  "specialHolidays", "mapLink", "bookingSlotIntervalMinutes"
];

const publicSettings = (business) => {
  const result = business.toObject ? business.toObject() : { ...business };
  delete result.owner;
  return result;
};

router.get("/", protect, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Business information is unavailable because MongoDB is disconnected." });
    }
    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) return res.status(404).json({ message: "Business not found for this shop URL." });
    await initializeBusinessSettings(business);
    res.json(publicSettings(business));
  } catch (error) {
    console.error("Business settings fetch error:", error);
    res.status(500).json({ message: "Error fetching business settings." });
  }
});

router.get("/welcome", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Welcome information is temporarily unavailable." });
    }
    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) return res.status(404).json({ message: "Business not found for this shop URL." });
    await initializeBusinessSettings(business);
    res.json({
      name: business.name,
      logo: business.logo,
      heroImage: business.heroImage || business.aboutImage || "",
      shortDescription: String(business.description || "").replace(/\s+/g, " ").trim().slice(0, 220)
    });
  } catch (error) {
    console.error("Welcome information fetch error:", error);
    res.status(500).json({ message: "Unable to load welcome information." });
  }
});

router.get("/settings", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Business settings cannot be loaded until MongoDB is connected." });
    }
    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business settings not found." });
    await initializeBusinessSettings(business);
    res.json(publicSettings(business));
  } catch (error) {
    console.error("Owner settings fetch error:", error);
    res.status(500).json({ message: "Error loading your business settings." });
  }
});

router.put("/", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Business settings cannot be saved until MongoDB is connected." });
    }
    const errorMessage = validateSettings(req.body);
    if (errorMessage) return res.status(400).json({ message: errorMessage });
    const updates = Object.fromEntries(allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
      .map((field) => [field, req.body[field]]));

    if (updates.weeklySchedule) {
      updates.workingDays = updates.weeklySchedule.filter((entry) => !entry.closed).map((entry) => entry.day);
      updates.weeklyHolidays = updates.weeklySchedule.filter((entry) => entry.closed).map((entry) => entry.day);
      const firstSession = updates.weeklySchedule.find((entry) => !entry.closed)?.sessions?.[0];
      if (firstSession) {
        updates.openingHours = firstSession.open;
        updates.closingHours = firstSession.close;
      }
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business settings not found." });
    business.set({ ...updates, settingsInitialized: true });
    await business.save();
    res.json({ message: "Business settings updated successfully.", business: publicSettings(business) });
  } catch (error) {
    console.error("Business settings update error:", error);
    res.status(500).json({ message: "Error updating business settings." });
  }
});

module.exports = router;
