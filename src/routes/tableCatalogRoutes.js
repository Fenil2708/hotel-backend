const express = require("express");
const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const { getTables, createTable, updateTable, seedDefaultTables } = require("../controllers/tableCatalogController");

const router = express.Router();

router.get("/", authMiddleware, adminMiddleware, getTables);
router.post("/", authMiddleware, adminMiddleware, createTable);
router.put("/:id", authMiddleware, adminMiddleware, updateTable);
router.post("/seed-defaults", authMiddleware, adminMiddleware, seedDefaultTables);

module.exports = router;
