const Category = require("../models/Category");

const getCategories = async (req, res) => {
    try {
        const cats = await Category.find();
        res.json(cats);
    } catch(e) {
        res.status(500).json({ message: e.message });
    }
};

const createCategory = async (req, res) => {
    try {
        const cat = await Category.create({ name: req.body.name });
        res.status(201).json(cat);
    } catch(e) {
        if(e.code === 11000) return res.status(400).json({ message: "Category name must be unique." });
        res.status(500).json({ message: e.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: "Category deleted" });
    } catch(e) {
        res.status(500).json({ message: e.message });
    }
};

const updateCategory = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Category name is required." });
    const cat = await Category.findByIdAndUpdate(req.params.id, { name }, { new: true });
    if (!cat) return res.status(404).json({ message: "Category not found." });
    res.json(cat);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: "Category name must be unique." });
    res.status(500).json({ message: e.message });
  }
};

module.exports = { getCategories, createCategory, deleteCategory, updateCategory };
