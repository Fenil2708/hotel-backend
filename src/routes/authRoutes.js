const express = require("express");

const {
  loginAdmin,
  registerAdmin,
  requestOtp,
  verifyOtp,
  loginCustomer,
  updateProfile,
} = require("../controllers/authController");

const authMiddleware = require("../middlewares/auth");

const router = express.Router();

router.post("/admin/login", loginAdmin);
router.post("/admin/register", registerAdmin);

router.post("/customer/login", loginCustomer);
router.post("/customer/request-otp", requestOtp);
router.post("/customer/verify-otp", verifyOtp);

// ✅ ADD THIS
router.put("/profile", authMiddleware, updateProfile);

module.exports = router;