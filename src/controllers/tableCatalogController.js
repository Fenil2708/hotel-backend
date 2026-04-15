const DiningTable = require("../models/DiningTable");

const getTables = async (req, res) => {
  try {
    const tables = await DiningTable.find().sort({ tableNumber: 1 });
    res.json(tables);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createTable = async (req, res) => {
  try {
    const tableNumber = Number(req.body.tableNumber);
    const capacity = Number(req.body.capacity);
    if (!Number.isInteger(tableNumber) || tableNumber < 1) return res.status(400).json({ message: "Invalid table number" });
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return res.status(400).json({ message: "Capacity must be 1-20" });
    const table = await DiningTable.create({ tableNumber, capacity, isActive: true });
    res.status(201).json(table);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: "Table number already exists." });
    res.status(500).json({ message: e.message });
  }
};

const updateTable = async (req, res) => {
  try {
    const payload = {};
    if (req.body.capacity != null) {
      const capacity = Number(req.body.capacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return res.status(400).json({ message: "Capacity must be 1-20" });
      payload.capacity = capacity;
    }
    if (req.body.isActive != null) payload.isActive = Boolean(req.body.isActive);
    const table = await DiningTable.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!table) return res.status(404).json({ message: "Table not found" });
    res.json(table);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const seedDefaultTables = async (req, res) => {
  try {
    const defaults = [
      { tableNumber: 1, capacity: 5 },
      { tableNumber: 2, capacity: 4 },
      { tableNumber: 3, capacity: 6 },
      { tableNumber: 4, capacity: 4 },
      { tableNumber: 5, capacity: 2 },
      { tableNumber: 6, capacity: 8 },
      { tableNumber: 7, capacity: 4 },
      { tableNumber: 8, capacity: 6 },
    ];
    for (const row of defaults) {
      await DiningTable.updateOne({ tableNumber: row.tableNumber }, { $setOnInsert: { ...row, isActive: true } }, { upsert: true });
    }
    const tables = await DiningTable.find().sort({ tableNumber: 1 });
    res.json({ message: "Default tables ensured", tables });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getTables, createTable, updateTable, seedDefaultTables };
