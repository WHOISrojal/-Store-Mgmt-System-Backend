const express = require("express");
const router = express.Router();

const Customer = require("../models/Customer");
const CustomerTransaction = require("../models/CustomerTransaction");

// Get All Customer Transactions
router.get("/", async (req, res) => {
  try {
    const transactions = await CustomerTransaction.find()
      .populate("customer");

    res.json(transactions);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Customer Purchase on Credit (Udharo)
router.post("/purchase", async (req, res) => {
  try {
    const {
      customerId,
      amount,
      note,
    } = req.body;

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const transaction = new CustomerTransaction({
      customer: customerId,
      type: "PURCHASE",
      amount,
      note,
    });

    const savedTransaction = await transaction.save();

    customer.dueAmount += amount;

    await customer.save();

    res.status(201).json(savedTransaction);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Customer Payment
router.post("/payment", async (req, res) => {
  try {
    const {
      customerId,
      amount,
      note,
      paymentMethod, // "CASH" | "ONLINE"
    } = req.body;

    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const transaction = new CustomerTransaction({
      customer: customerId,
      type: "PAYMENT",
      amount,
      note,
      paymentMethod: paymentMethod === "ONLINE" ? "ONLINE" : "CASH",
    });

    const savedTransaction = await transaction.save();

    customer.dueAmount -= amount;

    if (customer.dueAmount < 0) {
      customer.dueAmount = 0;
    }

    await customer.save();

    res.status(201).json(savedTransaction);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Get Transactions For One Customer
router.get("/:customerId", async (req, res) => {
  try {
    const transactions = await CustomerTransaction.find({
      customer: req.params.customerId,
    })
      .populate("customer")
      .sort({ createdAt: -1 });

    res.json(transactions);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;