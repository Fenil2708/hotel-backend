const express = require("express");
const { getCategories, createCategory, deleteCategory, updateCategory } = require("../controllers/categoryController");
const { adminMiddleware } = require("../middlewares/auth");

const router = express.Router();

router.get("/", getCategories);
router.post("/", adminMiddleware, createCategory);
router.put("/:id", adminMiddleware, updateCategory);
router.delete("/:id", adminMiddleware, deleteCategory);

module.exports = router;
