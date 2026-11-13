const { DAY_NAMES } = require("./schedule");

const DEFAULT_FACILITIES = [
  { title: "Professional Haircuts and Styling", icon: "✂", description: "Personalized cuts and styling shaped around your look." },
  { title: "Hair Spa and Hair Treatments", icon: "✦", description: "Relaxing care and treatments for healthy-looking hair." },
  { title: "Facial and Skin Care", icon: "☼", description: "Comforting skin-care services selected for your needs." },
  { title: "Bridal and Party Makeup", icon: "✧", description: "Makeup services for celebrations and special occasions." },
  { title: "Manicure and Pedicure", icon: "♡", description: "Thoughtful nail care in a calm, comfortable setting." },
  { title: "Comfortable Waiting Area", icon: "▣", description: "A welcoming space to relax before your appointment." },
  { title: "Clean and Hygienic Environment", icon: "✓", description: "A clean environment with careful attention to hygiene." },
  { title: "Online Appointment Booking", icon: "◷", description: "Choose an available appointment time online." }
];

const DEFAULT_TESTIMONIALS = [
  { name: "Priya Sharma", location: "Mumbai", rating: 5, review: "The haircut suited me perfectly, and the stylist listened carefully.", isDemo: true },
  { name: "Rahul Verma", location: "Delhi", rating: 4, review: "The salon felt welcoming, and the staff were friendly throughout my visit.", isDemo: true },
  { name: "Neha Gupta", location: "Jaipur", rating: 3, review: "The facial was relaxing, though I had to wait a little after arriving.", isDemo: true },
  { name: "Anjali Singh", location: "Pune", rating: 5, review: "Booking online was simple, and I received helpful service from the team.", isDemo: true },
  { name: "Rohan Mehta", location: "Ahmedabad", rating: 4, review: "I enjoyed the hair spa and the calm atmosphere.", isDemo: true },
  { name: "Sneha Patel", location: "Surat", rating: 3, review: "The service was good, and the staff answered my questions kindly.", isDemo: true }
];

const DEFAULT_WEEKLY_SCHEDULE = DAY_NAMES.map((day) => ({
  day,
  closed: day === "sunday",
  sessions: day === "sunday" ? [] : [{ open: "09:00", close: "17:00" }]
}));

const initializeBusinessSettings = async (business) => {
  if (business.settingsInitialized) return business;
  business.weeklySchedule = DEFAULT_WEEKLY_SCHEDULE;
  business.bookingSlotIntervalMinutes = 30;
  business.workingDays = DAY_NAMES.filter((day) => day !== "sunday");
  business.weeklyHolidays = ["sunday"];
  business.facilities = DEFAULT_FACILITIES;
  business.testimonials = DEFAULT_TESTIMONIALS;
  business.settingsInitialized = true;
  await business.save();
  return business;
};

module.exports = {
  DEFAULT_FACILITIES,
  DEFAULT_TESTIMONIALS,
  DEFAULT_WEEKLY_SCHEDULE,
  initializeBusinessSettings
};
