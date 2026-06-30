const express = require("express");
const router = express.Router();

const Customer = require("../models/Customer");

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

module.exports = router;