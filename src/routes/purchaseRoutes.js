const express = require("express");
const router  = express.Router();

const Purchase            = require("../models/Purchase");
const Product             = require("../models/Product");
const Supplier            = require("../models/Supplier");
const SupplierTransaction = require("../models/SupplierTransaction");
const AuditLog            = require("../models/AuditLog");
const StockMovement       = require("../models/StockMovement");
const auth                = require("../middleware/auth");
const admin               = require("../middleware/admin");

// GET /purchases?page=1&limit=15&search=&supplier=
router.get("/", async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.max(1, parseInt(req.query.limit) || 15);
    const skip     = (page - 1) * limit;
    const search   = req.query.search?.trim();
    const supplier = req.query.supplier?.trim();

    const filter = {};

    if (supplier) {
      filter.supplier = { $regex: supplier, $options: "i" };
    }

    if (search) {
      // Search matching products first
      const matchingProducts = await Product.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");

      filter.$or = [
        { supplier:      { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
        { product: { $in: matchingProducts.map(p => p._id) } },
      ];
    }

    const [purchases, totalCount] = await Promise.all([
      Purchase.find(filter)
        .populate("product")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Purchase.countDocuments(filter),
    ]);

    res.json({
      purchases,
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /purchases/stats
router.get("/stats", async (req, res) => {
  try {
    const [totalCount, totalSpentAgg, uniqueSuppliers] = await Promise.all([
      Purchase.countDocuments(),
      Purchase.aggregate([
        { $group: { _id: null, total: { $sum: { $multiply: ["$costPrice", "$quantity"] } } } },
      ]),
      Purchase.distinct("supplier"),
    ]);

    res.json({
      totalCount,
      totalSpent:      totalSpentAgg[0]?.total || 0,
      uniqueSuppliers: uniqueSuppliers.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /purchases  (unchanged logic)
router.post("/", auth, admin, async (req, res) => {
  try {
    const { supplier, product, quantity, costPrice, invoiceNumber } = req.body;

    const purchase = new Purchase({ supplier, product, quantity, costPrice, invoiceNumber });
    const savedPurchase = await purchase.save();

    await AuditLog.create({
      user: "ADMIN",
      action: "CREATE PURCHASE",
      details: `${supplier} | Qty ${quantity} | Rs.${costPrice}`,
    });

    const supplierRecord = await Supplier.findOne({ name: supplier });
    if (supplierRecord) {
      await new SupplierTransaction({
        supplier: supplierRecord._id,
        type: "PURCHASE",
        amount: quantity * costPrice,
        note: `Purchase of ${quantity} units`,
      }).save();
      supplierRecord.dueAmount += quantity * costPrice;
      await supplierRecord.save();
    }

    const existingProduct = await Product.findById(product);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    await StockMovement.create({
      product: existingProduct._id,
      type: "PURCHASE",
      quantity,
      note: "Purchase",
    });

    await Product.findByIdAndUpdate(product, { $inc: { stock: quantity } });

    res.status(201).json(savedPurchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;