const express = require("express");
const { getFoods, createFood, updateFood, deleteFood } = require("../controllers/foodController");
const { adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

// Public: Customers can view menu
router.get("/", getFoods);

// Admin: Manage menu
router.post("/", adminMiddleware, createFood);
router.put("/:id", adminMiddleware, updateFood);
router.delete("/:id", adminMiddleware, deleteFood);

module.exports = router;
