const mongoose = require("mongoose");

const completedBillSchema = new mongoose.Schema(
  {
    tableNumber: { type: Number, required: true },
    tableSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "TableSession" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food" },
        name: String,
        selectedOption: { type: String, default: "" },
        quantity: Number,
        price: Number,
        lineTotal: Number,
      },
    ],
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cash", "online"], default: "cash" },
    stripeSessionId: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    review: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompletedBill", completedBillSchema);
