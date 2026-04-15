const User = require("../models/User");
const OtpVerification = require("../models/OtpVerification");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");

// SendGrid setup
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM;

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
      user,
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

    res.status(201).json({ message: "Admin created", user });
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
      user,
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(password, 10);

    await OtpVerification.deleteOne({ email });

    await OtpVerification.create({
      name,
      email,
      passwordHash,
      otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sgMail.send({
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
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  loginAdmin,
  registerAdmin,
  loginCustomer,
  requestOtp,
  verifyOtp,
};