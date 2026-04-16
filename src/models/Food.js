const mongoose = require("mongoose");

const foodVariantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    options: [{ type: String }], // e.g., ["Butter", "Oil", "Ghee"]
    variants: [foodVariantSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Food", foodSchema);
