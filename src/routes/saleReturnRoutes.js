const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const SaleReturn = require("../models/SaleReturn");
const StockMovement = require("../models/StockMovement");

// Return Item
router.post("/", async (req, res) => {
  try {
    const { saleId, productId, quantity, reason } = req.body;

    const sale = await Sale.findById(saleId);

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    const saleItem = sale.items.find(
      (item) => item.product.toString() === productId,
    );

    if (!saleItem) {
      return res.status(404).json({
        message: "Product not found in sale",
      });
    }

    const previousReturns = await SaleReturn.find({
      sale: saleId,
      product: productId,
    });

    const totalReturned = previousReturns.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    const remainingQuantity = saleItem.quantity - totalReturned;

    if (quantity > remainingQuantity) {
      return res.status(400).json({
        message: `Only ${remainingQuantity} item(s) can still be returned`,
      });
    }

    const amount = saleItem.sellingPrice * quantity;

    const profitReduction =
      (saleItem.sellingPrice - saleItem.costPrice) * quantity;

    const saleReturn = new SaleReturn({
      sale: saleId,
      product: productId,
      quantity,
      amount,
      profitReduction,
      reason,
    });

    await saleReturn.save();

    const product = await Product.findById(productId);

    if (product) {
      product.stock += quantity;

      await StockMovement.create({
        product: product._id,
        type: "RETURN",
        quantity,
        note: reason || "Sale Return",
      });

      await product.save();
    }

    res.status(201).json(saleReturn);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Get Returns For Sale
router.get("/:saleId", async (req, res) => {
  try {
    const returns = await SaleReturn.find({
      sale: req.params.saleId,
    })
      .populate("product")
      .populate("sale")
      .sort({ createdAt: -1 });

    res.json(returns);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
