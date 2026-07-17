const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Expense = require("../models/Expense");
const Supplier = require("../models/Supplier");
const CustomerTransaction = require("../models/CustomerTransaction");

router.get("/", async (req, res) => {
  try {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const totalProducts = await Product.countDocuments();

    const totalCustomers = await Customer.countDocuments();

    const totalSuppliers = await Supplier.countDocuments();

    const suppliers = await Supplier.find();

    const totalSupplierDue = suppliers.reduce(
      (sum, supplier) => sum + supplier.dueAmount,
      0,
    );

    const customers = await Customer.find();

    const totalCustomerDue = customers.reduce(
      (sum, customer) => sum + customer.dueAmount,
      0,
    );

    const expenses = await Expense.find();

    const customerPayments = await CustomerTransaction.find({
      type: "PAYMENT",
    });

    const todayCustomerPayments = customerPayments
      .filter((payment) => new Date(payment.createdAt) >= today)
      .reduce((sum, payment) => sum + payment.amount, 0);

    const totalExpenses = expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

    const todayExpenses = expenses
      .filter((expense) => new Date(expense.createdAt) >= today)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const lowStockProducts = await Product.find({
      $expr: {
        $lte: ["$stock", "$minimumStock"],
      },
    });

    const sales = await Sale.find().populate("customer");

    const pendingCheques = sales.filter(
      (sale) =>
        sale.paymentType === "CHEQUE" && sale.chequeStatus === "PENDING",
    );

    const pendingChequeAmount = pendingCheques.reduce(
      (sum, sale) => sum + sale.totalAmount,
      0,
    );

    const clearedChequeAmount = sales
      .filter(
        (sale) =>
          sale.paymentType === "CHEQUE" && sale.chequeStatus === "CLEARED",
      )
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const bouncedChequeAmount = sales
      .filter(
        (sale) =>
          sale.paymentType === "CHEQUE" && sale.chequeStatus === "BOUNCED",
      )
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const overdueChequeAmount = pendingCheques
      .filter((sale) => {
        if (!sale.chequeDate) return false;

        return new Date(sale.chequeDate) < today;
      })
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const todayCheques = pendingCheques.filter((sale) => {
      if (!sale.chequeDate) return false;

      const chequeDate = new Date(sale.chequeDate);

      return chequeDate.toDateString() === today.toDateString();
    });

    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    const upcomingCheques = pendingCheques.filter((sale) => {
      if (!sale.chequeDate) return false;

      const chequeDate = new Date(sale.chequeDate);

      return chequeDate >= today && chequeDate <= next7Days;
    });

    const overdueCheques = pendingCheques.filter((sale) => {
      if (!sale.chequeDate) return false;

      const chequeDate = new Date(sale.chequeDate);

      return chequeDate < today;
    });

    const last7DaysSales = [];

    for (let i = 6; i >= 0; i--) {
      const day = new Date();

      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);

      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const daySales = sales
        .filter(
          (sale) =>
            new Date(sale.createdAt) >= day &&
            new Date(sale.createdAt) < nextDay,
        )
        .reduce((sum, sale) => sum + sale.totalAmount, 0);

      last7DaysSales.push({
        label: day.toLocaleDateString(),
        sales: daySales,
      });
    }

    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
    const todaySales = sales
      .filter((sale) => new Date(sale.createdAt) >= today)
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const todayProfit = sales
      .filter((sale) => new Date(sale.createdAt) >= today)
      .reduce((sum, sale) => sum + sale.profit, 0);

    const todayCashSales = sales
      .filter(
        (sale) =>
          new Date(sale.createdAt) >= today && sale.paymentType === "CASH",
      )
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const todayCreditSales = sales
      .filter(
        (sale) =>
          new Date(sale.createdAt) >= today && sale.paymentType === "CREDIT",
      )
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const todayNetProfit = todayProfit - todayExpenses;

    const todayNetCash = todayCashSales + todayCustomerPayments - todayExpenses;

    // ── Discount stats ────────────────────────────────
    const totalDiscountGiven = sales.reduce(
      (sum, sale) => sum + (sale.discountAmount || 0),
      0,
    );

    const todayDiscountGiven = sales
      .filter((sale) => new Date(sale.createdAt) >= today)
      .reduce((sum, sale) => sum + (sale.discountAmount || 0), 0);

    const productSales = {};
    const productProfits = {};

    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const productId = item.product.toString();

        if (!productSales[productId]) {
          productSales[productId] = 0;
        }

        productSales[productId] += item.quantity;

        if (!productProfits[productId]) {
          productProfits[productId] = 0;
        }

        productProfits[productId] +=
          (item.sellingPrice - item.costPrice) * item.quantity;
      });
    });

    const allProducts = await Product.find();

    const inventoryValue = allProducts.reduce(
      (sum, product) => sum + product.stock * product.costPrice,
      0,
    );

    const topSellingProducts = allProducts
      .map((product) => ({
        _id: product._id,
        name: product.name,
        sold: productSales[product._id.toString()] || 0,
      }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    const topProfitableProducts = allProducts
      .map((product) => ({
        _id: product._id,
        name: product.name,
        profit: productProfits[product._id.toString()] || 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    const categorySales = {};

    allProducts.forEach((product) => {
      const category = product.category || "General";

      if (!categorySales[category]) {
        categorySales[category] = 0;
      }

      categorySales[category] += productProfits[product._id.toString()] || 0;
    });

    const topCategories = Object.entries(categorySales)
      .map(([category, profit]) => ({
        category,
        profit,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    res.json({
      totalProducts,
      totalCustomers,
      totalCustomerDue,

      totalExpenses,
      totalSales,
      totalProfit,

      todaySales,
      todayProfit,
      todayExpenses,
      todayNetProfit,

      lowStockProducts,
      topSellingProducts,
      topProfitableProducts,
      topCategories,

      last7DaysSales,
      totalSuppliers,
      totalSupplierDue,
      inventoryValue,

      todayCashSales,
      todayCreditSales,
      todayCustomerPayments,
      todayNetCash,

      pendingChequeAmount,
      todayCheques,
      upcomingCheques,
      overdueCheques,

      pendingChequeAmount,
      clearedChequeAmount,
      bouncedChequeAmount,
      overdueChequeAmount,

      chequeSummary: {
        pending: pendingChequeAmount,
        cleared: clearedChequeAmount,
        bounced: bouncedChequeAmount,
        overdue: overdueChequeAmount,
      },

      salesTrend: last7DaysSales.map((day) => ({
        label: day.label,
        value: day.sales,
      })),

      categories: topCategories.map((category) => ({
        name: category.category,
        profit: category.profit,
      })),

      totalDiscountGiven,
      todayDiscountGiven,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
