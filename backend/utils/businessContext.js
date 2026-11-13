const Business = require("../models/Business");
const User = require("../models/User");
const { initializeBusinessSettings } = require("./businessDefaults");

const initialize = async (business) => {
  if (!business) return null;
  return initializeBusinessSettings(business);
};

const createBusinessForOwner = async (user) => {
  const legacyAdminEmails = new Set([
    (process.env.ADMIN_EMAIL || "admin@business.com").toLowerCase(),
    "admin@business.com"
  ]);
  if (legacyAdminEmails.has(String(user.email || "").toLowerCase())) {
    const legacyBusiness = await Business.findOne({
      owner: { $exists: false }
    }).sort({ createdAt: 1 });

    if (legacyBusiness) {
      legacyBusiness.owner = user._id;
      await legacyBusiness.save();
      await User.updateOne(
        { _id: user._id, $or: [{ business: null }, { business: { $exists: false } }] },
        { $set: { business: legacyBusiness._id } }
      );
      user.business = legacyBusiness._id;
      return initialize(legacyBusiness);
    }
  }

  const baseSlug = String(user.email || user._id)
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "business";
  let slug = baseSlug;
  let suffix = 2;
  while (await Business.exists({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const business = await Business.create({
    owner: user._id,
    slug,
    name: `${user.name || "My"}'s Business`
  });
  user.business = business._id;
  await User.updateOne({ _id: user._id }, { $set: { business: business._id } });
  return initialize(business);
};

const getBusinessForRequest = async (req, { createForOwner = true } = {}) => {
  if (req.user) {
    if (req.user.business) {
      const ownedBusiness = await Business.findOne({
        _id: req.user.business,
        owner: req.user._id
      });
      if (ownedBusiness) return initialize(ownedBusiness);
    }

    const existingBusiness = await Business.findOne({ owner: req.user._id });
    if (existingBusiness) {
      req.user.business = existingBusiness._id;
      return initialize(existingBusiness);
    }

    if (createForOwner && req.user.role === "admin") return createBusinessForOwner(req.user);
  }

  const slug = req.query?.businessSlug || req.params?.businessSlug;
  const business = slug
    ? await Business.findOne({ slug: String(slug).toLowerCase() })
    : await Business.findOne().sort({ createdAt: 1 });
  return initialize(business);
};

module.exports = { getBusinessForRequest, createBusinessForOwner };
