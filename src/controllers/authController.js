const User = require("../models/User");
const OtpVerification = require("../models/OtpVerification");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const normalizeEnvValue = (value) => String(value || "").trim().replace(/^['"]|['"]$/g, "");
const SMTP_USER = normalizeEnvValue(process.env.EMAIL_USER);
const SMTP_PASS = normalizeEnvValue(process.env.EMAIL_PASS);
const SMTP_HOST = normalizeEnvValue(process.env.SMTP_HOST) || "smtp.gmail.com";
const SMTP_PORT = Number(normalizeEnvValue(process.env.SMTP_PORT) || 587);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // ❌ 465 mate true hoy, pan have false rakho
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET || "hotel-secret",
    { expiresIn: "10h" }
  );
};

const OTP_TTL_MS = 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;

// Admin Login
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.role !== "admin") return res.status(401).json({ message: "Invalid admin credentials" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid admin credentials" });
    res.json({ token: generateToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile, avatar: user.avatar } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin Register
const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already registered" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role: "admin" });
    res.status(201).json({ message: "Admin registered successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Customer OTP Request (Signup/Login combined flow or pure Signup -> OTP)
const requestOtp = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already taken. Try login." });

    const recentOtp = await OtpVerification.findOne({ email });
    if (recentOtp) {
      const elapsed = Date.now() - new Date(recentOtp.lastSentAt).getTime();
      if (elapsed < OTP_RESEND_WAIT_MS) {
        const retryAfterSeconds = Math.max(1, Math.ceil((OTP_RESEND_WAIT_MS - elapsed) / 1000));
        return res.status(429).json({ message: "Wait before requesting a new OTP.", retryAfterSeconds });
      }
    }

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    
    await OtpVerification.findOneAndDelete({ email });
    await OtpVerification.create({
      name, email, passwordHash, role: role || "user", otp,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastSentAt: new Date(),
    });

    if (!SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({ message: "Email credentials are not configured on server." });
    }

    try {
      await transporter.sendMail({
        from: `"Hotel Dine-In" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verification OTP - Hotel Dine-In",
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">Welcome to Hotel Dine-In!</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1a1a1a; padding: 10px 0;">${otp}</div>
            <p style="color: #666; font-size: 14px;">Valid for 1 minute. If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Email send err:", err);
      return res.status(500).json({ message: "Failed to send OTP email. Check SMTP credentials." });
    }

    res.json({ message: "OTP sent to your email address." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OtpVerification.findOne({ email });
    if (!record || record.otp !== otp || new Date() > record.expiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    const user = await User.create({
      name: record.name, email: record.email, password: record.passwordHash, role: record.role
    });
    await OtpVerification.deleteOne({ _id: record._id });
    res.status(201).json({ token: generateToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile, avatar: user.avatar } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Customer Login
const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.role !== "user") return res.status(401).json({ message: "Invalid customer credentials" });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ message: "Invalid credentials" });
    res.json({ token: generateToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile, avatar: user.avatar } });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyToken = (req, res) => {
    res.json({ message: "Token valid", user: req.user });
};

const updateProfile = async (req, res) => {
  try {
    const { name, mobile, avatar } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.name = name || user.name;
    user.mobile = mobile || user.mobile;
    user.avatar = avatar || user.avatar;
    await user.save();
    res.json({ token: generateToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile, avatar: user.avatar } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) return res.status(400).json({ message: "Incorrect current password" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch(e) {
    res.status(500).json({ message: e.message });
  }
};

const requestPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await User.findOne({ email, role: "user" });
    if (!user) return res.status(404).json({ message: "User not found with this email." });

    const existing = await PasswordResetOtp.findOne({ email });
    if (existing) {
      const elapsed = Date.now() - new Date(existing.lastSentAt).getTime();
      if (elapsed < OTP_RESEND_WAIT_MS) {
        const retryAfterSeconds = Math.max(1, Math.ceil((OTP_RESEND_WAIT_MS - elapsed) / 1000));
        return res.status(429).json({ message: "Wait 1 minute before resending OTP.", retryAfterSeconds });
      }
    }

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    await PasswordResetOtp.findOneAndDelete({ email });
    await PasswordResetOtp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastSentAt: new Date(),
    });

    if (!SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({ message: "Email credentials are not configured on server." });
    }

    await transporter.sendMail({
      from: `"Hotel Dine-In" <${SMTP_USER}>`,
      to: email,
      subject: "Password Reset OTP - Hotel Dine-In",
      html: `<p>Your password reset OTP is <strong style="font-size:22px;letter-spacing:4px;">${otp}</strong>. Valid for 1 minute.</p>`,
    });

    res.json({ message: "Password reset OTP sent." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const record = await PasswordResetOtp.findOne({ email });
    if (!record || record.otp !== otp || new Date() > record.expiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    const resetToken = jwt.sign({ email, purpose: "password-reset" }, process.env.JWT_SECRET || "hotel-secret", { expiresIn: "5m" });
    await PasswordResetOtp.deleteOne({ _id: record._id });
    res.json({ resetToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    const payload = jwt.verify(resetToken, process.env.JWT_SECRET || "hotel-secret");
    if (payload.purpose !== "password-reset") return res.status(400).json({ message: "Invalid reset token." });
    const user = await User.findOne({ email: payload.email, role: "user" });
    if (!user) return res.status(404).json({ message: "User not found." });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password reset successful." });
  } catch (error) {
    res.status(400).json({ message: "Invalid or expired reset session." });
  }
};

module.exports = {
  loginAdmin,
  registerAdmin,
  requestOtp,
  verifyOtp,
  loginCustomer,
  verifyToken,
  updateProfile,
  changePassword,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
};
