const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Food = require("../models/Food");
const { seedFoods } = require("./seed");

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hotel-dine-in");
    console.log("Database connected.");
    
    // Seed Foods
    if ((await Food.countDocuments()) === 0) await Food.insertMany(seedFoods);
    
    // Static admin removed as per requirements. Admin must register via /admin/register
  } catch (error) {
    console.error("DB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDb;
