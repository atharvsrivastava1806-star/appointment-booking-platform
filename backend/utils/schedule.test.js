const test = require("node:test");
const assert = require("node:assert/strict");
const { getAvailabilitySlots } = require("./schedule");

const date = "2099-01-05";

const business = {
  timeZone: "Asia/Kolkata",
  weeklyHolidays: [],
  weeklySchedule: [
    { day: "monday", closed: false, sessions: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "15:00" }] }
  ],
  specialHolidays: []
};

test("generates duration-aware slots across split sessions without lunch-break slots", () => {
  const slots = getAvailabilitySlots({
    date,
    duration: 60,
    business,
    now: new Date("2026-01-01T00:00:00Z")
  });

  assert.ok(slots.includes("11:00"));
  assert.ok(slots.includes("14:00"));
  assert.ok(!slots.includes("11:15"));
  assert.ok(!slots.includes("12:00"));
  assert.ok(!slots.includes("12:45"));
  assert.ok(!slots.includes("14:15"));

  assert.deepEqual(getAvailabilitySlots({
    date,
    duration: 30,
    business,
    intervalMinutes: 60,
    now: new Date("2026-01-01T00:00:00Z")
  }), ["09:00", "10:00", "11:00", "13:00", "14:00"]);
});

test("respects weekly and special holiday closures", () => {
  assert.deepEqual(getAvailabilitySlots({
    date,
    duration: 30,
    business: { ...business, weeklyHolidays: ["monday"] },
    now: new Date("2026-01-01T00:00:00Z")
  }), []);

  assert.deepEqual(getAvailabilitySlots({
    date,
    duration: 30,
    business: { ...business, specialHolidays: [{ date }] },
    now: new Date("2026-01-01T00:00:00Z")
  }), []);

  const specialHours = getAvailabilitySlots({
    date,
    duration: 30,
    business: {
      ...business,
      weeklyHolidays: ["monday"],
      specialHolidays: [{ date, sessions: [{ open: "16:00", close: "17:00" }] }]
    },
    now: new Date("2026-01-01T00:00:00Z")
  });
  assert.deepEqual(specialHours, ["16:00", "16:30"]);
});

test("respects staff sessions and overlapping appointments", () => {
  const staff = [{
    _id: "staff-1",
    services: [],
    availability: [{
      day: "monday",
      useBusinessHours: false,
      closed: false,
      sessions: [{ open: "10:00", close: "12:00" }],
      slots: []
    }]
  }];
  const slots = getAvailabilitySlots({
    date,
    duration: 60,
    business,
    staff,
    staffId: "staff-1",
    appointments: [{
      date,
      time: "10:00",
      serviceDuration: 60,
      staff: "staff-1",
      status: "CONFIRMED"
    }],
    now: new Date("2026-01-01T00:00:00Z")
  });

  assert.ok(!slots.includes("09:00"));
  assert.ok(!slots.includes("10:00"));
  assert.ok(slots.includes("11:00"));
});

test("keeps staff schedules independent and permits selecting each member", () => {
  const staff = [
    {
      _id: "staff-a",
      services: [],
      availability: [{
        day: "monday",
        useBusinessHours: false,
        closed: false,
        sessions: [{ open: "10:00", close: "12:00" }],
        slots: []
      }]
    },
    {
      _id: "staff-b",
      services: [],
      availability: [{
        day: "monday",
        useBusinessHours: false,
        closed: false,
        sessions: [{ open: "13:00", close: "15:00" }],
        slots: []
      }]
    }
  ];

  const staffASlots = getAvailabilitySlots({
    date,
    duration: 30,
    business,
    staff,
    staffId: "staff-a",
    now: new Date("2026-01-01T00:00:00Z")
  });
  const staffBSlots = getAvailabilitySlots({
    date,
    duration: 30,
    business,
    staff,
    staffId: "staff-b",
    now: new Date("2026-01-01T00:00:00Z")
  });

  assert.ok(staffASlots.includes("10:00"));
  assert.ok(!staffASlots.includes("13:00"));
  assert.ok(staffBSlots.includes("13:00"));
  assert.ok(!staffBSlots.includes("10:00"));
});

test("a booking for one staff member does not block the same time for another", () => {
  const staff = ["staff-a", "staff-b"].map((_id) => ({
    _id,
    services: [],
    availability: [{
      day: "monday",
      useBusinessHours: false,
      closed: false,
      sessions: [{ open: "09:00", close: "12:00" }],
      slots: []
    }]
  }));
  const appointments = [{
    date,
    time: "10:00",
    serviceDuration: 60,
    staff: "staff-a",
    status: "CONFIRMED"
  }];
  const staffASlots = getAvailabilitySlots({
    date,
    duration: 30,
    business,
    staff,
    staffId: "staff-a",
    appointments,
    now: new Date("2026-01-01T00:00:00Z")
  });
  const staffBSlots = getAvailabilitySlots({
    date,
    duration: 30,
    business,
    staff,
    staffId: "staff-b",
    appointments,
    now: new Date("2026-01-01T00:00:00Z")
  });
  const anyStaffSlots = getAvailabilitySlots({
    date,
    duration: 30,
    business,
    staff,
    appointments,
    now: new Date("2026-01-01T00:00:00Z")
  });

  assert.ok(!staffASlots.includes("10:00"));
  assert.ok(staffBSlots.includes("10:00"));
  assert.ok(anyStaffSlots.includes("10:00"));
});

test("staff with an unconfigured day inherits business hours but explicit closures stay closed", () => {
  const tuesday = "2099-01-06";
  const tuesdayBusiness = {
    ...business,
    weeklySchedule: [
      ...business.weeklySchedule,
      { day: "tuesday", closed: false, sessions: [{ open: "09:00", close: "11:00" }] }
    ]
  };
  const staff = [{
    _id: "staff-1",
    services: [],
    availability: [{
      day: "monday",
      useBusinessHours: true,
      closed: false,
      sessions: [],
      slots: []
    }]
  }];
  const inheritedSlots = getAvailabilitySlots({
    date: tuesday,
    duration: 30,
    business: tuesdayBusiness,
    staff,
    now: new Date("2026-01-01T00:00:00Z")
  });
  assert.deepEqual(inheritedSlots, ["09:00", "09:30", "10:00", "10:30"]);

  const explicitlyClosedSlots = getAvailabilitySlots({
    date: tuesday,
    duration: 30,
    business: tuesdayBusiness,
    staff: [{
      ...staff[0],
      availability: [...staff[0].availability, {
        day: "tuesday",
        useBusinessHours: false,
        closed: true,
        sessions: [],
        slots: []
      }]
    }],
    now: new Date("2026-01-01T00:00:00Z")
  });
  assert.deepEqual(explicitlyClosedSlots, []);
});
