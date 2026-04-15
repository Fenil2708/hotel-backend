const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    tableSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "TableSession" },
    tableNumber: { type: Number, required: true },
    items: [{ 
      foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true }, 
      quantity: Number,
      selectedOption: { type: String, default: "" }
    }],
    total: { type: Number, required: true },
    status: { type: String, default: "Pending" }, // Pending -> Accepted -> Served
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
