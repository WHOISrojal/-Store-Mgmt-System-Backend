const express = require("express");
const router = express.Router();

const Expense = require("../models/Expense");
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");

const admin = require("../middleware/admin");

// Get All Expenses
router.get("/", async (req, res) => {
  try {
    const expenses = await Expense.find();

    res.json(expenses);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Add Expense
router.post("/", auth, admin, async (req, res) => {
  try {
    const { title, amount, category, note } = req.body;

    const expense = new Expense({
      title,
      amount,
      category,
      note,
    });

    const savedExpense = await expense.save();

    await AuditLog.create({
      user: "ADMIN",
      action: "CREATE EXPENSE",
      details: `${title} | ${category} | Rs.${amount}`,
    });

    res.status(201).json(savedExpense);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
