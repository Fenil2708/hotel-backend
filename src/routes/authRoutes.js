const express = require("express");

const {
  loginAdmin,
  registerAdmin,
  requestOtp,
  verifyOtp,
  loginCustomer,
  updateProfile,
  changePassword,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} = require("../controllers/authController");

const { authMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.post("/admin/login", loginAdmin);
router.post("/admin/register", registerAdmin);

router.post("/customer/login", loginCustomer);
router.post("/customer/request-otp", requestOtp);
router.post("/customer/verify-otp", verifyOtp);

router.put("/profile", authMiddleware, updateProfile);
router.put("/change-password", authMiddleware, changePassword);
router.post("/forgot-password/request-otp", requestPasswordResetOtp);
router.post("/forgot-password/verify-otp", verifyPasswordResetOtp);
router.post("/forgot-password/reset", resetPassword);

module.exports = router;
