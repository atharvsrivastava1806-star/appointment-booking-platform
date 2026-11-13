require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectDB = require("./config/db");
const Business = require("./models/Business");
const User = require("./models/User");
const Service = require("./models/Service");
const Staff = require("./models/Staff");
const Appointment = require("./models/Appointment");
const Customer = require("./models/Customer");
const Review = require("./models/Review");
const Payment = require("./models/Payment");
const Contact = require("./models/Contact");
const { initializeBusinessSettings } = require("./utils/businessDefaults");
const { DAY_NAMES } = require("./utils/schedule");

const defaultBusinessData = {
  name: "Your Business",
  slug: "your-business",
  businessType: "other",
  description: "Professional services tailored to your needs.",
  phone: "",
  email: "",
  address: "",
  whatsapp: "",
  openingHours: "",
  closingHours: "",
  logo: "/assets/logo-placeholder.svg",
  heroImage: "",
  gallery: [],
  websiteColors: {
    primaryColor: "#8b5cf6",
    secondaryColor: "#f59e0b",
    backgroundColor: "#f6f7fb",
    textColor: "#101828"
  }
};

const defaultServices = [
  {
    name: "Initial Consultation",
    description: "Discuss your needs and choose the right service.",
    price: 300,
    duration: 30,
    category: "General"
  },
  {
    name: "Standard Appointment",
    description: "A scheduled one-to-one service appointment.",
    price: 500,
    duration: 45,
    category: "General"
  },
  {
    name: "Follow-up Session",
    description: "A follow-up appointment for existing customers.",
    price: 250,
    duration: 30,
    category: "General"
  },
  {
    name: "Extended Appointment",
    description: "Extra time for services that need a longer session.",
    price: 800,
    duration: 60,
    category: "General"
  }
];

const defaultStaff = [
  {
    name: "Aarav Sharma",
    role: "Hair Stylist",
    services: ["Initial Consultation", "Standard Appointment", "Extended Appointment"]
  },
  {
    name: "Riya Verma",
    role: "Beauty Specialist",
    services: ["Follow-up Session"]
  }
];
const defaultStaffAvailability = DAY_NAMES.map((day) => ({
  day,
  closed: day === "sunday",
  useBusinessHours: day !== "sunday",
  sessions: [],
  slots: []
}));

const seedData = async () => {
  try {
    await connectDB();

    let business = await Business.findOne();
    if (!business) {
      business = await Business.create(defaultBusinessData);
    } else if (business.name === "Elite Care Studio") {
      business = await Business.findByIdAndUpdate(
        business._id,
        {
          $set: {
            name: defaultBusinessData.name,
            slug: defaultBusinessData.slug,
            businessType: defaultBusinessData.businessType,
            description: defaultBusinessData.description,
            phone: defaultBusinessData.phone,
            email: defaultBusinessData.email,
            address: defaultBusinessData.address,
            whatsapp: defaultBusinessData.whatsapp,
            openingHours: defaultBusinessData.openingHours,
            closingHours: defaultBusinessData.closingHours,
            logo: defaultBusinessData.logo,
            heroImage: defaultBusinessData.heroImage,
            gallery: defaultBusinessData.gallery
          }
        },
        { new: true, runValidators: true }
      );
    }

    const bootstrapEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const bootstrapPassword = process.env.ADMIN_PASSWORD || "";
    if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) {
      throw new Error("Set both ADMIN_EMAIL and ADMIN_PASSWORD to create a restricted bootstrap owner.");
    }

    if (bootstrapEmail) {
      const existingAdmin = await User.findOne({ email: bootstrapEmail, role: "admin" });
      if (!existingAdmin) {
        if (await User.exists({ email: bootstrapEmail })) {
          throw new Error("The configured bootstrap email already belongs to a non-owner account.");
        }
        const newAdmin = await User.create({
          name: "Business Owner",
          email: bootstrapEmail,
          password: await bcrypt.hash(bootstrapPassword, 10),
          role: "admin"
        });
        if (!business.owner) {
          business.owner = newAdmin._id;
          await business.save();
          newAdmin.business = business._id;
          await newAdmin.save();
        }
      } else if (!existingAdmin.business) {
        const ownedBusiness = await Business.findOne({ owner: existingAdmin._id });
        if (ownedBusiness) {
          existingAdmin.business = ownedBusiness._id;
          await existingAdmin.save();
        } else if (!business.owner) {
          business.owner = existingAdmin._id;
          await business.save();
          existingAdmin.business = business._id;
          await existingAdmin.save();
        }
      }
    } else {
      console.log("Skipping bootstrap owner creation; public registration is restricted to salon owners.");
    }

    await initializeBusinessSettings(business);

    if (business.owner) {
      const unassignedBusinessData = {
        $or: [{ business: { $exists: false } }, { business: null }]
      };
      await Promise.all([
        Appointment.updateMany(unassignedBusinessData, { $set: { business: business._id } }),
        Customer.updateMany(unassignedBusinessData, { $set: { business: business._id } }),
        Review.updateMany(unassignedBusinessData, { $set: { business: business._id } }),
        Payment.updateMany(unassignedBusinessData, { $set: { business: business._id } }),
        Contact.updateMany(unassignedBusinessData, { $set: { business: business._id } }),
        Service.updateMany(unassignedBusinessData, { $set: { business: business._id } }),
        Staff.updateMany(unassignedBusinessData, { $set: { business: business._id } })
      ]);
    }

    const serviceCount = await Service.countDocuments({ business: business._id });
    if (serviceCount === 0) {
      for (const service of defaultServices) {
        await Service.create({
          ...service,
          business: business._id
        });
      }
    }

    const staffCount = await Staff.countDocuments({ business: business._id });
    if (staffCount === 0) {
      const serviceDocs = await Service.find({ business: business._id });
      const serviceMap = {};

      serviceDocs.forEach((item) => {
        serviceMap[item.name] = item._id;
      });

      for (const person of defaultStaff) {
        const selectedServices = person.services
          .map((name) => serviceMap[name])
          .filter(Boolean);

        await Staff.create({
          business: business._id,
          name: person.name,
          role: person.role,
          services: selectedServices,
          availability: defaultStaffAvailability,
          isDemo: true
        });
      }
    } else if (business.slug === defaultBusinessData.slug) {
      const serviceDocs = await Service.find({ business: business._id });
      const serviceMap = new Map(serviceDocs.map((service) => [service.name, service._id]));
      const legacyDemoStaff = [
        {
          oldName: "Alex",
          oldRole: "Service Professional",
          name: "Aarav Sharma",
          role: "Hair Stylist",
          services: ["Initial Consultation", "Standard Appointment", "Extended Appointment"]
        },
        {
          oldName: "Jordan",
          oldRole: "Specialist",
          name: "Riya Verma",
          role: "Beauty Specialist",
          services: ["Follow-up Session"]
        }
      ];

      for (const person of legacyDemoStaff) {
        const serviceIds = person.services.map((serviceName) => serviceMap.get(serviceName)).filter(Boolean);
        if (serviceIds.length !== person.services.length) continue;
        const member = await Staff.findOne({
          business: business._id,
          name: person.oldName,
          role: person.oldRole,
          services: { $all: serviceIds, $size: serviceIds.length },
          isDemo: { $ne: true }
        });
        if (member) {
          member.name = person.name;
          member.role = person.role;
          member.isDemo = true;
          await member.save();
        }
      }
    }

    console.log("Seed data completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
};

seedData();