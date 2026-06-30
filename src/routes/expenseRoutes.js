const express  = require("express");
const router   = express.Router();

const Expense  = require("../models/Expense");
const AuditLog = require("../models/AuditLog");
const auth     = require("../middleware/auth");
const admin    = require("../middleware/admin");

// GET /expenses/stats
router.get("/stats", async (req, res) => {
  try {
    const [totalCount, totalAmountAgg, categories] = await Promise.all([
      Expense.countDocuments(),
      Expense.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Expense.distinct("category"),
    ]);

    res.json({
      totalCount,
      totalAmount:      totalAmountAgg[0]?.total || 0,
      uniqueCategories: categories.filter(Boolean).length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /expenses?page=1&limit=15&search=&category=
router.get("/", async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.max(1, parseInt(req.query.limit) || 15);
    const skip     = (page - 1) * limit;
    const search   = req.query.search?.trim();
    const category = req.query.category?.trim();

    const filter = {};

    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    if (search) {
      filter.$or = [
        { title:    { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { note:     { $regex: search, $options: "i" } },
      ];
    }

    const [expenses, totalCount] = await Promise.all([
      Expense.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Expense.countDocuments(filter),
    ]);

    res.json({
      expenses,
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /expenses
router.post("/", auth, admin, async (req, res) => {
  try {
    const { title, amount, category, note } = req.body;

    const expense = new Expense({ title, amount, category, note });
    const savedExpense = await expense.save();

    await AuditLog.create({
      user: "ADMIN",
      action: "CREATE EXPENSE",
      details: `${title} | ${category} | Rs.${amount}`,
    });

    res.status(201).json(savedExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;