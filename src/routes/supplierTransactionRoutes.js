const express = require("express");
const router = express.Router();

const Supplier = require("../models/Supplier");
const SupplierTransaction = require(
  "../models/SupplierTransaction"
);

// Get Transactions For One Supplier
router.get("/:supplierId", async (req, res) => {
  try {
    const transactions =
      await SupplierTransaction.find({
        supplier: req.params.supplierId,
      })
        .populate("supplier")
        .sort({ createdAt: -1 });

    res.json(transactions);

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Supplier Purchase (Increase Due)
router.post("/purchase", async (req, res) => {
  try {
    const {
      supplierId,
      amount,
      note,
    } = req.body;

    const supplier =
      await Supplier.findById(
        supplierId
      );

    if (!supplier) {
      return res.status(404).json({
        message:
          "Supplier not found",
      });
    }

    const transaction =
      new SupplierTransaction({
        supplier: supplierId,
        type: "PURCHASE",
        amount,
        note,
      });

    await transaction.save();

    supplier.dueAmount += amount;

    await supplier.save();

    res.status(201).json(
      transaction
    );

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Supplier Payment (Decrease Due)
router.post("/payment", async (req, res) => {
  try {
    const {
      supplierId,
      amount,
      note,
    } = req.body;

    const supplier =
      await Supplier.findById(
        supplierId
      );

    if (!supplier) {
      return res.status(404).json({
        message:
          "Supplier not found",
      });
    }

    const transaction =
      new SupplierTransaction({
        supplier: supplierId,
        type: "PAYMENT",
        amount,
        note,
      });

    await transaction.save();

    supplier.dueAmount -= amount;

    if (supplier.dueAmount < 0) {
      supplier.dueAmount = 0;
    }

    await supplier.save();

    res.status(201).json(
      transaction
    );

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;