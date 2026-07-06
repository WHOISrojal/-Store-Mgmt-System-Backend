const express = require("express");
const router = express.Router();

const Customer = require("../models/Customer");
const CustomerTransaction = require("../models/CustomerTransaction");
const auth  = require("../middleware/auth");
const admin = require("../middleware/admin");

// Get All Customers
router.get("/", async (req, res) => {
  try {
    const customers = await Customer.find();

    res.json(customers);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Add New Customer
router.post("/", async (req, res) => {
  try {
    const { name, phone, panNumber, address } = req.body;

    if (!panNumber || !/^\d{9}$/.test(panNumber)) {
      return res.status(400).json({ message: "PAN must be exactly 9 digits" });
    }

    const customer = new Customer({
      name,
      phone,
      panNumber,
      address,
    });

    const savedCustomer = await customer.save();

    res.status(201).json(savedCustomer);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Delete Customer — ADMIN only, blocked if due > 0 or transaction history exists
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (customer.dueAmount > 0) {
      return res.status(400).json({
        message: `Cannot delete customer with a pending due of Rs. ${customer.dueAmount}. Clear the due first.`,
      });
    }

    const hasTransactions = await CustomerTransaction.exists({
      customer: req.params.id,
    });

    if (hasTransactions) {
      return res.status(400).json({
        message: "Cannot delete customer with existing sales/transaction history.",
      });
    }

    await Customer.findByIdAndDelete(req.params.id);

    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;