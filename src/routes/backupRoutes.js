const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const Sale = require("../models/Sale");
const Customer = require("../models/Customer");
const Expense = require("../models/Expense");
const Supplier = require("../models/Supplier");
const CustomerTransaction = require("../models/CustomerTransaction");
const SupplierTransaction = require("../models/SupplierTransaction");
const SaleReturn = require("../models/SaleReturn");
const Setting = require("../models/Setting");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

router.get("/export", auth, admin, async (req, res) => {
  try {
    const backup = {
      products: await Product.find(),
      purchases: await Purchase.find(),
      sales: await Sale.find(),
      customers: await Customer.find(),
      expenses: await Expense.find(),
      suppliers: await Supplier.find(),

      customerTransactions: await CustomerTransaction.find(),

      supplierTransactions: await SupplierTransaction.find(),

      saleReturns: await SaleReturn.find(),

      settings: await Setting.find(),

      users: await User.find(),
    };

    await AuditLog.create({
      user: "ADMIN",
      action: "CREATE BACKUP",
      details: "Database backup exported",
    });

    res.json(backup);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

router.post("/restore", auth, admin, async (req, res) => {
  try {
    const backup = req.body;

    await Product.deleteMany({});
    await Purchase.deleteMany({});
    await Sale.deleteMany({});
    await Customer.deleteMany({});
    await Expense.deleteMany({});
    await Supplier.deleteMany({});
    await CustomerTransaction.deleteMany({});
    await SupplierTransaction.deleteMany({});
    await SaleReturn.deleteMany({});
    await Setting.deleteMany({});
    await User.deleteMany({});

    if (backup.products?.length) {
      await Product.insertMany(backup.products);
    }

    if (backup.purchases?.length) {
      await Purchase.insertMany(backup.purchases);
    }

    if (backup.sales?.length) {
      await Sale.insertMany(backup.sales);
    }

    if (backup.customers?.length) {
      await Customer.insertMany(backup.customers);
    }

    if (backup.expenses?.length) {
      await Expense.insertMany(backup.expenses);
    }

    if (backup.suppliers?.length) {
      await Supplier.insertMany(backup.suppliers);
    }
    if (backup.customerTransactions?.length) {
      await CustomerTransaction.insertMany(backup.customerTransactions);
    }

    if (backup.supplierTransactions?.length) {
      await SupplierTransaction.insertMany(backup.supplierTransactions);
    }

    if (backup.saleReturns?.length) {
      await SaleReturn.insertMany(backup.saleReturns);
    }

    if (backup.settings?.length) {
      await Setting.insertMany(backup.settings);
    }

    if (backup.users?.length) {
      await User.insertMany(backup.users);
    }

    await AuditLog.create({
      user: "ADMIN",
      action: "RESTORE BACKUP",
      details: "Database restored from backup",
    });

    res.json({
      message: "Backup restored successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
