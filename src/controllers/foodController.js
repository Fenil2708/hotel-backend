const Food = require("../models/Food");
const Category = require("../models/Category");

function normalizeFoodPayload(body = {}) {
  const variants = Array.isArray(body.variants)
    ? body.variants
        .map((variant) => ({
          name: String(variant?.name || "").trim(),
          price: Number(variant?.price),
          isDefault: Boolean(variant?.isDefault),
        }))
        .filter((variant) => variant.name && Number.isFinite(variant.price) && variant.price >= 0)
    : [];

  const defaultVariantIndex = variants.findIndex((variant) => variant.isDefault);
  if (variants.length && defaultVariantIndex === -1) {
    variants[0].isDefault = true;
  } else if (defaultVariantIndex > 0) {
    variants.forEach((variant, index) => {
      variant.isDefault = index === defaultVariantIndex;
    });
  }

  const parsedPrice = Number(body.price);
  const fallbackPrice = variants.find((variant) => variant.isDefault)?.price ?? variants[0]?.price ?? parsedPrice;

  return {
    name: String(body.name || "").trim(),
    category: body.category,
    price: Number(fallbackPrice),
    image: String(body.image || "").trim(),
    description: String(body.description || "").trim(),
    options: Array.isArray(body.options)
      ? body.options.map((option) => String(option || "").trim()).filter(Boolean)
      : [],
    variants,
  };
}

const getFoods = async (req, res) => {
  try {
    const foods = await Food.find().populate("category").sort({ createdAt: -1 });
    res.json(foods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createFood = async (req, res) => {
  try {
    const payload = normalizeFoodPayload(req.body);
    if (!payload.name || !payload.image || !payload.description) {
      return res.status(400).json({ message: "Name, image and description are required." });
    }
    if ((!payload.variants.length && (!Number.isFinite(payload.price) || payload.price < 0)) || payload.variants.some((variant) => variant.price < 0)) {
      return res.status(400).json({ message: "Enter a valid price or variant prices." });
    }
    const categoryExists = await Category.exists({ _id: payload.category });
    if (!categoryExists) {
      return res.status(400).json({ message: "Select a valid category." });
    }
    const food = await Food.create(payload);
    res.status(201).json(food);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateFood = async (req, res) => {
  try {
    const payload = normalizeFoodPayload(req.body);
    if (!payload.name || !payload.image || !payload.description) {
      return res.status(400).json({ message: "Name, image and description are required." });
    }
    if ((!payload.variants.length && (!Number.isFinite(payload.price) || payload.price < 0)) || payload.variants.some((variant) => variant.price < 0)) {
      return res.status(400).json({ message: "Enter a valid price or variant prices." });
    }
    const categoryExists = await Category.exists({ _id: payload.category });
    if (!categoryExists) {
      return res.status(400).json({ message: "Select a valid category." });
    }
    const food = await Food.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!food) return res.status(404).json({ message: "Food not found" });
    res.json(food);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteFood = async (req, res) => {
  try {
    await Food.findByIdAndDelete(req.params.id);
    res.json({ message: "Food deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getFoods, createFood, updateFood, deleteFood };
