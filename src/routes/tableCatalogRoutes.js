const express = require("express");
const { adminMiddleware } = require("../middlewares/auth");
const { getTables, createTable, updateTable, seedDefaultTables } = require("../controllers/tableCatalogController");

const router = express.Router();

router.get("/", adminMiddleware, getTables);
router.post("/", adminMiddleware, createTable);
router.put("/:id", adminMiddleware, updateTable);
router.post("/seed-defaults", adminMiddleware, seedDefaultTables);

module.exports = router;
