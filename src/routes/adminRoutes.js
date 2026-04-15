const express = require("express");
const { getDashboardStats, updateOrderStatus, forceCloseTable, getBillHistory, getAllUsers, getUserHistory, getProfitStats } = require("../controllers/adminController");
const { adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.get("/dashboard", adminMiddleware, getDashboardStats);
router.get("/users", adminMiddleware, getAllUsers);
router.get("/users/:id/history", adminMiddleware, getUserHistory);
router.get("/profit", adminMiddleware, getProfitStats);
router.patch("/orders/:id/status", adminMiddleware, updateOrderStatus);
router.post("/table-sessions/:id/force-close", adminMiddleware, forceCloseTable);
router.get("/history", adminMiddleware, getBillHistory);

module.exports = router;
