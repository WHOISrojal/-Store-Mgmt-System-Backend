const express = require("express");
const router = express.Router();

const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const SupplierTransaction = require("../models/SupplierTransaction");
const AuditLog = require("../models/AuditLog");
const StockMovement = require("../models/StockMovement");
const auth = require("../middleware/auth");

const admin = require("../middleware/admin");

// Get All Purchases
router.get("/", async (req, res) => {
  try {
    const purchases = await Purchase.find().populate("product");

    res.json(purchases);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Add Purchase
router.post("/", auth, admin, async (req, res) => {
  try {
    const { supplier, product, quantity, costPrice, invoiceNumber } = req.body;

    const purchase = new Purchase({
      supplier,
      product,
      quantity,
      costPrice,
      invoiceNumber,
    });

    const savedPurchase = await purchase.save();
    await AuditLog.create({
      user: "ADMIN",
      action: "CREATE PURCHASE",
      details: `${supplier} | Qty ${quantity} | Rs.${costPrice}`,
    });

    const supplierRecord = await Supplier.findOne({
      name: supplier,
    });

    if (supplierRecord) {
      const transaction = new SupplierTransaction({
        supplier: supplierRecord._id,
        type: "PURCHASE",
        amount: quantity * costPrice,
        note: `Purchase of ${quantity} units`,
      });

      await transaction.save();

      supplierRecord.dueAmount += quantity * costPrice;

      await supplierRecord.save();
    }

    const existingProduct = await Product.findById(product);

    if (!existingProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    await StockMovement.create({
      product: existingProduct._id,
      type: "PURCHASE",
      quantity: quantity,
      note: "Purchase",
    });

    await Product.findByIdAndUpdate(product, {
      $inc: {
        stock: quantity,
      },
    });

    res.status(201).json(savedPurchase);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
