const express = require("express");
const router = express.Router();

const Supplier = require("../models/Supplier");
const auth = require("../middleware/auth");

const admin = require("../middleware/admin");

// Get All Suppliers
router.get("/", async (req, res) => {
  try {
    const suppliers = await Supplier.find();

    res.json(suppliers);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Add Supplier
router.post("/", auth, admin, async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;

    const supplier = new Supplier({
      name,
      phone,
      address,
      notes,
    });

    const savedSupplier = await supplier.save();

    res.status(201).json(savedSupplier);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Delete Supplier
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    await Supplier.findByIdAndDelete(req.params.id);

    res.json({
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
