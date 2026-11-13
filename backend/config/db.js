const mongoose = require("mongoose");

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes("*") || uri.includes("your_")) {
    return "mongodb://127.0.0.1:27017/appointment_platform";
  }

  return uri;
};

const connectDB = async () => {
  const uri = getMongoUri();

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });

    console.log("MongoDB connected successfully");
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    console.log("Falling back to local development mode. Set MONGODB_URI to enable database-backed features.");
    return false;
  }
};

module.exports = connectDB;