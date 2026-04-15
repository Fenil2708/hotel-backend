const express = require("express");

const {
  loginAdmin,
  registerAdmin,
  requestOtp,
  verifyOtp,
  loginCustomer,
} = require("../controllers/authController");

const router = express.Router();

router.post("/admin/login", loginAdmin);
router.post("/admin/register", registerAdmin);

router.post("/customer/login", loginCustomer);

router.post("/customer/request-otp", requestOtp);
router.post("/customer/verify-otp", verifyOtp);

module.exports = router;