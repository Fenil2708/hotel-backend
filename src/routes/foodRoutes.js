const express = require("express");
const { getFoods, createFood, updateFood, deleteFood } = require("../controllers/foodController");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

// Public: Customers can view menu
router.get("/", getFoods);

// Admin: Manage menu
router.post("/", authMiddleware, adminMiddleware, createFood);
router.put("/:id", authMiddleware, adminMiddleware, updateFood);
router.delete("/:id", authMiddleware, adminMiddleware, deleteFood);

module.exports = router;
