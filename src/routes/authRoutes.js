const express = require("express");
const {
  loginAdmin,
  registerAdmin,
  requestOtp,
  verifyOtp,
  loginCustomer,
  verifyToken,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
} = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.post("/admin/login", loginAdmin);
router.post("/admin/register", registerAdmin);
router.post("/customer/login", loginCustomer);
router.post("/customer/request-otp", requestOtp);
router.post("/customer/verify-otp", verifyOtp);
router.post("/forgot-password/request-otp", requestPasswordResetOtp);
router.post("/forgot-password/verify-otp", verifyPasswordResetOtp);
router.post("/forgot-password/reset", resetPasswordWithOtp);
router.get("/verify", verifyToken); // Can add standard auth middleware later

router.put("/profile", authMiddleware, require("../controllers/authController").updateProfile);
router.put("/change-password", authMiddleware, require("../controllers/authController").changePassword);

module.exports = router;
