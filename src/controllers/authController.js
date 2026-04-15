const User = require("../models/User");
const OtpVerification = require("../models/OtpVerification");
const PasswordResetOtp = require("../models/PasswordResetOtp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");

// ✅ SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM;

// Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET || "hotel-secret",
    { expiresIn: "10h" }
  );
};

const OTP_TTL_MS = 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;

// ================= ADMIN =================
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.role !== "admin")
      return res.status(401).json({ message: "Invalid admin credentials" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({ message: "Invalid admin credentials" });

    res.json({
      token: generateToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        mobile: user.mobile,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    res.status(201).json({ message: "Admin registered successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= OTP =================
const requestOtp = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email is required" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already taken. Try login." });

    const recentOtp = await OtpVerification.findOne({ email });
    if (recentOtp) {
      const elapsed = Date.now() - new Date(recentOtp.lastSentAt).getTime();
      if (elapsed < OTP_RESEND_WAIT_MS) {
        return res.status(429).json({
          message: "Wait before requesting a new OTP.",
        });
      }
    }

    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await OtpVerification.findOneAndDelete({ email });

    await OtpVerification.create({
      name,
      email,
      passwordHash,
      role: role || "user",
      otp,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      lastSentAt: new Date(),
    });

    // ✅ SendGrid mail
    await sgMail.send({
      to: email,
      from: EMAIL_FROM,
      subject: "Verification OTP - Hotel Dine-In",
      html: `
        <div style="font-family: sans-serif;">
          <h2>Welcome to Hotel Dine-In</h2>
          <h1>${otp}</h1>
          <p>Valid for 1 minute</p>
        </div>
      `,
    });

    res.json({ message: "OTP sent to your email address." });
  } catch (error) {
    console.log("Email send err:", error);
    res.status(500).json({ message: "Failed to send OTP email." });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await OtpVerification.findOne({ email });

    if (!record || record.otp !== otp || new Date() > record.expiresAt)
      return res.status(400).json({ message: "Invalid or expired OTP" });

    const user = await User.create({
      name: record.name,
      email: record.email,
      password: record.passwordHash,
      role: record.role,
    });

    await OtpVerification.deleteOne({ _id: record._id });

    res.status(201).json({
      token: generateToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= LOGIN =================
const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || user.role !== "user")
      return res.status(401).json({ message: "Invalid credentials" });

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid)
      return res.status(401).json({ message: "Invalid credentials" });

    res.json({
      token: generateToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  loginAdmin,
  registerAdmin,
  requestOtp,
  verifyOtp,
  loginCustomer,
};