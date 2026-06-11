const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Expense = require("../models/Expense");
const Customer = require("../models/Customer");

router.get("/", async (req, res) => {
  try {

    const sales = await Sale.find();

    const totalSalesAmount = sales.reduce(
      (sum, sale) => sum + sale.totalAmount,
      0
    );

    const totalProfit = sales.reduce(
      (sum, sale) => sum + sale.profit,
      0
    );

    const expenses = await Expense.find();

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    const customers = await Customer.find();

    const totalCustomerDue = customers.reduce(
      (sum, customer) => sum + customer.dueAmount,
      0
    );

    const netProfit =
      totalProfit - totalExpenses;

      const monthlySales = Array(12).fill(0);

      sales.forEach((sale) => {
        const month = new Date(
          sale.createdAt
        ).getMonth();

        monthlySales[month] +=
          sale.totalAmount;
      });

    res.json({
      totalSalesAmount,
      totalProfit,
      totalExpenses,
      totalCustomerDue,
      netProfit,
      monthlySales,
    });

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;