const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const parseTime = (value) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const parseLegacyTime = (value) => {
  const exact = parseTime(value);
  if (exact !== null) return exact;
  const match = typeof value === "string" && value.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hour * 60 + Number(match[2]);
};

const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const getDayName = (date) => {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return DAY_NAMES[parsed.getUTCDay()];
};

const getLocalDateTime = (timeZone, now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute)
  };
};

const normalizeDay = (day) => {
  const normalized = String(day || "").toLowerCase();
  if (DAY_NAMES.includes(normalized)) return normalized;
  const shortName = normalized.slice(0, 3);
  return DAY_NAMES.find((name) => name.slice(0, 3) === shortName) || null;
};

const getAvailabilitySlots = ({
  date,
  duration,
  business,
  staff = [],
  appointments = [],
  staffId = "",
  serviceId = "",
  now = new Date(),
  intervalMinutes = 30
}) => {
  const day = getDayName(date);
  if (!day || !Number.isInteger(duration) || duration <= 0 ||
      !Number.isInteger(intervalMinutes) || intervalMinutes <= 0) return [];

  const specialHoliday = (business.specialHolidays || []).find((holiday) => holiday.date === date);
  if (specialHoliday && !Array.isArray(specialHoliday.sessions)) return [];
  if (!specialHoliday && Array.isArray(business.weeklyHolidays) && business.weeklyHolidays.includes(day)) return [];

  const daySchedule = (business.weeklySchedule || []).find((entry) => entry.day === day);
  if (!specialHoliday && daySchedule?.closed) return [];
  let sessions = specialHoliday?.sessions || daySchedule?.sessions || [];

  if (!sessions.length && !daySchedule && !specialHoliday) {
    const open = parseLegacyTime(business.openingHours);
    const close = parseLegacyTime(business.closingHours);
    if (open !== null && close !== null && close > open) sessions = [{ open: formatTime(open), close: formatTime(close) }];
  }

  const validSessions = sessions
    .map((session) => ({ open: parseTime(session.open), close: parseTime(session.close) }))
    .filter((session) => session.open !== null && session.close !== null && session.close > session.open);
  if (!validSessions.length) return [];

  const today = getLocalDateTime(business.timeZone || "Asia/Kolkata", now);
  if (date < today.date) return [];

  const candidates = staffId
    ? staff.filter((member) => String(member._id) === String(staffId))
    : staff.length ? staff : [null];
  const availableSlots = new Set();

  for (const session of validSessions) {
    for (let start = session.open; start + duration <= session.close; start += intervalMinutes) {
      if (date === today.date && start <= today.minutes) continue;

      for (const member of candidates) {
        if (member && Array.isArray(member.services) && member.services.length &&
            !member.services.some((id) => String(id?._id || id) === String(serviceId))) continue;

        if (member && Array.isArray(member.availability) && member.availability.length) {
          const staffSchedule = member.availability.find((entry) => normalizeDay(entry.day) === day);
          if (staffSchedule?.closed) continue;
          if (staffSchedule && staffSchedule.useBusinessHours !== true &&
              Array.isArray(staffSchedule.slots) && staffSchedule.slots.length &&
              !staffSchedule.slots.includes(formatTime(start))) continue;
          if (staffSchedule && staffSchedule.useBusinessHours !== true &&
              Array.isArray(staffSchedule.sessions) && staffSchedule.sessions.length &&
              !staffSchedule.sessions.some((item) => {
                const staffOpen = parseTime(item.open);
                const staffClose = parseTime(item.close);
                return staffOpen !== null && staffClose !== null && start >= staffOpen && start + duration <= staffClose;
              })) continue;
        }

        const hasConflict = appointments.some((appointment) => {
          if (appointment.status === "CANCELLED" || appointment.date !== date) return false;
          const appointmentStaffId = String(appointment.staff?._id || appointment.staff || "");
          if (member && appointmentStaffId && appointmentStaffId !== String(member._id)) return false;
          if (!member && appointment.staff) return false;
          const existingStart = parseTime(appointment.time);
          const existingDuration = Number(appointment.serviceDuration || appointment.service?.duration || 30);
          return existingStart !== null && start < existingStart + existingDuration && existingStart < start + duration;
        });
        if (!hasConflict) {
          availableSlots.add(formatTime(start));
          break;
        }
      }
    }
  }

  return [...availableSlots].sort();
};

module.exports = { DAY_NAMES, parseTime, parseLegacyTime, formatTime, getDayName, getLocalDateTime, normalizeDay, getAvailabilitySlots };
