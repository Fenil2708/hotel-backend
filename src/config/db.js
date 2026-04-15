const mongoose = require("mongoose");
const User = require("../models/User");
const Food = require("../models/Food");
const Category = require("../models/Category");
const { seedFoods } = require("./seed");

async function seedFoodCatalog() {
  if ((await Food.countDocuments()) > 0) return;

  for (const seedFood of seedFoods) {
    const categoryName = String(seedFood.category || "").trim();
    if (!categoryName) continue;

    const category = await Category.findOneAndUpdate(
      { name: categoryName },
      { $setOnInsert: { name: categoryName } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Food.create({
      ...seedFood,
      category: category._id,
      options: Array.isArray(seedFood.options) ? seedFood.options : [],
    });
  }
}

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/hotel-dine-in");
    console.log("Database connected.");
    
    await seedFoodCatalog();
    
    // Static admin removed as per requirements. Admin must register via /admin/register
  } catch (error) {
    console.error("DB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDb;
