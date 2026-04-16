const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    tableSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "TableSession" },
    tableNumber: { type: Number, required: true },
    items: [{ 
      foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true }, 
      quantity: Number,
      selectedOption: { type: String, default: "" },
      selectedVariant: { type: String, default: "" },
      unitPrice: { type: Number, default: 0 },
    }],
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Preparing", "Served", "Cancelled"],
      default: "Pending",
    },
    cancellationStatus: {
      type: String,
      enum: ["none", "requested", "rejected", "approved"],
      default: "none",
    },
    cancellationReason: { type: String, default: "" },
    cancellationRequestedAt: { type: Date, default: null },
    cancellationResolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
