const express = require("express");
const {
  getDashboardStats,
  updateOrderStatus,
  reviewCancellationRequest,
  forceCloseTable,
  getBillHistory,
  getAllUsers,
  getUserHistory,
  getProfitStats
} = require("../controllers/adminController");

const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

// 🔥 IMPORTANT FIX: authMiddleware first
router.get("/dashboard", authMiddleware, adminMiddleware, getDashboardStats);

router.get("/users", authMiddleware, adminMiddleware, getAllUsers);

router.get("/users/:id/history", authMiddleware, adminMiddleware, getUserHistory);

router.get("/profit", authMiddleware, adminMiddleware, getProfitStats);

router.patch("/orders/:id/status", authMiddleware, adminMiddleware, updateOrderStatus);
router.patch("/orders/:id/cancellation", authMiddleware, adminMiddleware, reviewCancellationRequest);

router.post("/table-sessions/:id/force-close", authMiddleware, adminMiddleware, forceCloseTable);

router.get("/history", authMiddleware, adminMiddleware, getBillHistory);

module.exports = router;
