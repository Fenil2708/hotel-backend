const mongoose = require("mongoose");

const passwordResetOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

passwordResetOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model("PasswordResetOtp", passwordResetOtpSchema);
