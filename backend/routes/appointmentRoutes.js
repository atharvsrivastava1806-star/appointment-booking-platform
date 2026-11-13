const express = require("express");
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Customer = require("../models/Customer");
const Service = require("../models/Service");
const Staff = require("../models/Staff");
const { protect, adminOnly } = require("../middleware/auth");
const { getBusinessForRequest } = require("../utils/businessContext");
const { getAvailabilitySlots, getDayName, parseTime } = require("../utils/schedule");

const router = express.Router();

router.get("/availability", protect, async (req, res) => {
  try {
    const { date, serviceId, staffId } = req.query;
    if (!date || !serviceId || !getDayName(date)) {
      return res.status(400).json({ message: "Choose a valid date and service." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Availability is unavailable because the database is disconnected." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) return res.status(404).json({ message: "Business not found for this shop URL." });
    if (!mongoose.Types.ObjectId.isValid(serviceId)) return res.status(404).json({ message: "Service not found." });

    const service = await Service.findOne({ _id: serviceId, business: business._id, isActive: true });
    if (!service) return res.status(404).json({ message: "Service not found." });

    const staffFilter = { business: business._id, isActive: true };
    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) return res.status(404).json({ message: "Staff member not found." });
      staffFilter._id = staffId;
    }
    const [staff, appointments] = await Promise.all([
      Staff.find(staffFilter).select("services availability"),
      Appointment.find({
        business: business._id,
        date,
        status: { $ne: "CANCELLED" }
      }).select("staff time date status serviceDuration service").populate("service", "duration")
    ]);

    if (staffId && !staff.length) return res.status(404).json({ message: "Staff member not found." });
    const slots = getAvailabilitySlots({
      date,
      duration: service.duration,
      business,
      staff,
      appointments,
      staffId,
      serviceId: service._id,
      intervalMinutes: business.bookingSlotIntervalMinutes || 30,
      now: new Date()
    });
    res.json({ slots });
  } catch (error) {
    console.error("Availability lookup error:", error);
    res.status(500).json({ message: "Unable to calculate available appointment times." });
  }
});

router.get("/mine", protect, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ message: "Customer sign-in is required to view personal bookings." });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "Your bookings are unavailable because the database is disconnected." });
  }

  try {
    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) return res.json([]);
    const customers = await Customer.find({
      business: business._id,
      user: req.user._id
    }).select("_id");
    const appointments = await Appointment.find({
      business: business._id,
      customer: { $in: customers.map((customer) => customer._id) }
    })
      .populate("customer", "name email phone")
      .populate("service", "name price duration")
      .populate("staff", "name")
      .sort({ date: -1, time: -1 });
    return res.json(appointments);
  } catch (error) {
    console.error("Customer bookings lookup error:", error);
    return res.status(500).json({ message: "Unable to load your bookings." });
  }
});

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const { status, date, search } = req.query;

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Appointments cannot be loaded until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) {
      return res.json([]);
    }

    const filter = { business: business._id };

    if (status) filter.status = status;
    if (date) filter.date = date;

    let appointments = await Appointment.find(filter)
      .populate("customer")
      .populate("service")
      .populate("staff")
      .sort({ createdAt: -1 });

    if (search) {
      const q = search.toLowerCase();

      appointments = appointments.filter((appointment) => {
        const customerName = appointment.customer?.name?.toLowerCase() || "";
        const serviceName = appointment.service?.name?.toLowerCase() || "";
        const staffName = appointment.staff?.name?.toLowerCase() || "";
        const bookingId = appointment.bookingId?.toLowerCase() || "";

        return (
          customerName.includes(q) ||
          serviceName.includes(q) ||
          staffName.includes(q) ||
          bookingId.includes(q)
        );
      });
    }

    res.json(appointments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching appointments" });
  }
});

router.get("/stats", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Appointment statistics are unavailable until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) {
      return res.json({
        totalAppointments: 0,
        todaysAppointments: 0,
        pendingAppointments: 0,
        confirmedAppointments: 0,
        cancelledAppointments: 0,
        totalCustomers: 0,
        totalServices: 0
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const totalAppointments = await Appointment.countDocuments({
      business: business._id
    });

    const todaysAppointments = await Appointment.countDocuments({
      business: business._id,
      date: today
    });

    const pendingAppointments = await Appointment.countDocuments({
      business: business._id,
      status: "PENDING"
    });

    const confirmedAppointments = await Appointment.countDocuments({
      business: business._id,
      status: "CONFIRMED"
    });

    const cancelledAppointments = await Appointment.countDocuments({
      business: business._id,
      status: "CANCELLED"
    });

    const totalCustomers = await Customer.countDocuments({ business: business._id });
    const totalServices = await Service.countDocuments({ business: business._id });

    res.json({
      totalAppointments,
      todaysAppointments,
      pendingAppointments,
      confirmedAppointments,
      cancelledAppointments,
      totalCustomers,
      totalServices
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error generating stats" });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const {
      serviceId,
      staffId,
      date,
      time,
      name,
      phone,
      email,
      message
    } = req.body;

    const customerAccount = req.user?.role === "customer" ? req.user : null;
    const customerName = customerAccount?.name || name;
    const customerEmail = customerAccount?.email || email;
    if (!serviceId || !date || !time || !customerName || !phone || !getDayName(date) || parseTime(time) === null) {
      return res.status(400).json({
        message: "Choose a valid service, date and time, and enter your name and phone number."
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Bookings are temporarily unavailable because the database is disconnected. Your appointment was not saved." });
    }

    const business = await getBusinessForRequest(req, { createForOwner: false });
    if (!business) {
      return res.status(404).json({ message: "Business settings not found for this shop URL." });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(404).json({ message: "Service not found." });
    }

    const service = await Service.findOne({
      _id: serviceId,
      business: business._id,
      isActive: true
    });
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    const staffFilter = { business: business._id, isActive: true };
    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) return res.status(404).json({ message: "Staff member not found." });
      staffFilter._id = staffId;
    }
    const [availableStaff, existingAppointments] = await Promise.all([
      Staff.find(staffFilter).select("name services availability"),
      Appointment.find({
        business: business._id,
        date,
        status: { $ne: "CANCELLED" }
      }).select("staff time date status serviceDuration service").populate("service", "duration")
    ]);

    if (staffId && !availableStaff.length) return res.status(404).json({ message: "Staff member not found." });
    const availableSlots = getAvailabilitySlots({
      date,
      duration: service.duration,
      business,
      staff: availableStaff,
      appointments: existingAppointments,
      staffId,
      serviceId: service._id,
      intervalMinutes: business.bookingSlotIntervalMinutes || 30,
      now: new Date()
    });
    if (!availableSlots.includes(time)) {
      return res.status(409).json({ message: "That appointment time is no longer available. Choose another time." });
    }

    let assignedStaff = staffId ? availableStaff[0] : null;
    if (!assignedStaff && availableStaff.length) {
      assignedStaff = availableStaff.find((member) => getAvailabilitySlots({
        date,
        duration: service.duration,
        business,
        staff: [member],
        appointments: existingAppointments,
        staffId: String(member._id),
        serviceId: service._id,
        intervalMinutes: business.bookingSlotIntervalMinutes || 30,
        now: new Date()
      }).includes(time)) || null;
      if (!assignedStaff) return res.status(409).json({ message: "No staff member is available at that time. Choose another time." });
    }

    const bookingId =
      "BK-" +
      Date.now().toString().slice(-6) +
      "-" +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    const customerFilter = customerAccount
      ? { business: business._id, user: customerAccount._id }
      : {
        business: business._id,
        phone: String(phone).trim(),
        email: String(customerEmail || "").trim().toLowerCase()
      };
    const customerFields = {
      business: business._id,
      name: String(customerName).trim(),
      phone: String(phone).trim(),
      email: String(customerEmail || "").trim().toLowerCase()
    };
    if (customerAccount) customerFields.user = customerAccount._id;

    const customer = await Customer.findOneAndUpdate(
      customerFilter,
      {
        $set: customerFields
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const appointment = await Appointment.create({
      business: business._id,
      customer: customer._id,
      service: service._id,
      servicePrice: service.price,
      serviceDuration: service.duration,
      staff: assignedStaff?._id || null,
      date,
      time,
      message: String(message || "").trim(),
      status: "PENDING",
      bookingId
    });

    res.status(201).json({
      message: "Appointment booked successfully.",
      bookingId: appointment.bookingId,
      appointmentId: appointment._id,
      customerId: customer._id,
      serviceId: service._id,
      serviceName: service.name,
      servicePrice: service.price,
      serviceDuration: service.duration,
      staffId: assignedStaff?._id || null,
      staffName: assignedStaff?.name || "Any",
      date,
      time,
      customer: { name: customer.name, phone: customer.phone, email: customer.email }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating appointment" });
  }
});

router.put("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ message: "Choose a valid appointment status." });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Appointments cannot be updated until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, business: business._id },
      { $set: { status } },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({
      message: "Appointment status updated successfully",
      appointment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating appointment status" });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Appointments cannot be deleted until MongoDB is connected." });
    }

    const business = await getBusinessForRequest(req);
    if (!business) return res.status(404).json({ message: "Business not found." });
    const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, business: business._id });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting appointment" });
  }
});

module.exports = router;