const User = require("../models/User");
const OtpVerification = require("../models/OtpVerification");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");

// SendGrid setup
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const EMAIL_FROM = process.env.EMAIL_FROM;
const PASSWORD_RESET_SECRET = process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET || "hotel-secret";

const sanitizeUser = (user) => {
  if (!user) return null;
  const raw = typeof user.toObject === "function" ? user.toObject() : { ...user };
  const { password, __v, ...safe } = raw;
  return {
    ...safe,
    id: String(raw._id),
  };
};

const sendEmail = async (payload) => {
  if (!process.env.SENDGRID_API_KEY || !EMAIL_FROM) {
    console.warn("Email credentials missing. Skipping email send for:", payload.to);
    return;
  }
  await sgMail.send(payload);
};

const createOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const signResetToken = (email) => jwt.sign({ email, scope: "password-reset" }, PASSWORD_RESET_SECRET, { expiresIn: "15m" });

// JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET || "hotel-secret",
    { expiresIn: "10h" }
  );
};

// ================= ADMIN LOGIN =================
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.role !== "admin") {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    res.json({
      token: generateToken(user),
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ADMIN REGISTER =================
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "admin",
    });

    res.status(201).json({ message: "Admin created", user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= CUSTOMER LOGIN =================
const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.role !== "user") {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      token: generateToken(user),
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= OTP REQUEST =================
const requestOtp = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const otp = createOtpCode();
    const passwordHash = await bcrypt.hash(password, 10);

    await OtpVerification.deleteOne({ email });

    await OtpVerification.create({
      name,
      email,
      passwordHash,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      lastSentAt: new Date(),
    });

    await sendEmail({
      to: email,
      from: EMAIL_FROM,
      subject: "OTP Verification",
      html: `<h1>Your OTP: ${otp}</h1>`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "OTP send failed" });
  }
};

// ================= VERIFY OTP =================
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await OtpVerification.findOne({ email });

    if (!record || record.otp !== otp || new Date() > record.expiresAt) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await User.create({
      name: record.name,
      email: record.email,
      password: record.passwordHash,
      role: "user",
    });

    await OtpVerification.deleteOne({ email });

    res.status(201).json({
      token: generateToken(user),
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware

    const { name, mobile, avatar } = req.body;

    const update = {
      name: String(name || "").trim(),
      mobile: String(mobile || "").trim(),
      avatar: String(avatar || "").trim(),
    };
    if (update.name.length < 2) {
      return res.status(400).json({ message: "Name must be at least 2 characters." });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      update,
      { new: true, runValidators: true }
    );

    res.json({
      message: "Profile updated successfully",
      token: generateToken(user),
      user: sanitizeUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old password and new password are required." });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.password) {
      return res.status(404).json({ message: "User not found." });
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const requestPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No account found for this email." });
    }

    const existing = await PasswordResetOtp.findOne({ email });
    if (existing?.lastSentAt) {
      const secondsSinceLastSend = Math.floor((Date.now() - existing.lastSentAt.getTime()) / 1000);
      if (secondsSinceLastSend < 60) {
        return res.status(429).json({
          message: "Please wait before requesting another OTP.",
          retryAfterSeconds: 60 - secondsSinceLastSend,
        });
      }
    }

    const otp = createOtpCode();
    await PasswordResetOtp.findOneAndUpdate(
      { email },
      { otp, expiresAt: new Date(Date.now() + 5 * 60 * 1000), lastSentAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendEmail({
      to: email,
      from: EMAIL_FROM,
      subject: "Password Reset OTP",
      html: `<h1>Your password reset OTP: ${otp}</h1>`,
    });

    res.json({ message: "Password reset OTP sent successfully." });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to send reset OTP." });
  }
};

const verifyPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const record = await PasswordResetOtp.findOne({ email });
    if (!record || record.otp !== otp || new Date() > record.expiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    await PasswordResetOtp.deleteOne({ email });
    res.json({ resetToken: signResetToken(email) });
  } catch (err) {
    res.status(500).json({ message: err.message || "OTP verification failed." });
  }
};

const resetPassword = async (req, res) => {
  try {
    const resetToken = String(req.body?.resetToken || "").trim();
    const newPassword = String(req.body?.newPassword || "");
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }

    const payload = jwt.verify(resetToken, PASSWORD_RESET_SECRET);
    if (payload.scope !== "password-reset" || !payload.email) {
      return res.status(400).json({ message: "Invalid reset token." });
    }

    const user = await User.findOne({ email: payload.email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password reset successful." });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Reset session expired. Please request OTP again." });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "Invalid reset token." });
    }
    res.status(500).json({ message: err.message || "Could not reset password." });
  }
};

module.exports = {
  loginAdmin,
  registerAdmin,
  loginCustomer,
  requestOtp,
  verifyOtp,
  updateProfile,
  changePassword,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
};
