const mongoose = require("mongoose");

const tableSessionSchema = new mongoose.Schema(
  {
    tableNumber: { type: Number, required: true },
    guests: { type: Number, default: 1 },
    token: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["open", "awaiting_payment", "closed"], default: "open" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TableSession", tableSessionSchema);
