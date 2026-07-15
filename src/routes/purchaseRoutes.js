const express = require("express");
const router  = express.Router();

const Purchase             = require("../models/Purchase");
const Product               = require("../models/Product");
const Supplier              = require("../models/Supplier");
const SupplierTransaction   = require("../models/SupplierTransaction");
const AuditLog              = require("../models/AuditLog");
const StockMovement         = require("../models/StockMovement");
const auth                  = require("../middleware/auth");
const admin                 = require("../middleware/admin");

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

// POST /purchases
// Accepts: { supplier, newProduct: { name, category, barcode, lotNo, code, unit, sellingPrice, minimumStock },
//            quantity, costPrice, invoiceNumber }
// Every purchase creates a brand-new product, using the purchase's quantity as
// its initial stock and costPrice as its cost price.
router.post("/", auth, admin, async (req, res) => {
  try {
    const { supplier, newProduct, quantity, costPrice, invoiceNumber } = req.body;

    if (!supplier)   return res.status(400).json({ message: "Supplier is required" });
    if (!newProduct) return res.status(400).json({ message: "Product details are required" });
    if (!newProduct.name?.trim()) return res.status(400).json({ message: "Product name is required" });
    if (!newProduct.sellingPrice) return res.status(400).json({ message: "Selling price is required" });
    if (!quantity || Number(quantity) <= 0)  return res.status(400).json({ message: "A valid quantity is required" });
    if (!costPrice || Number(costPrice) <= 0) return res.status(400).json({ message: "A valid cost price is required" });

    const createdProduct = await new Product({
      name: newProduct.name.trim(),
      category: newProduct.category || "",
      barcode: newProduct.barcode || "",
      lotNo: newProduct.lotNo || "",
      code: newProduct.code || "",
      image: "",
      costPrice: Number(costPrice),
      sellingPrice: Number(newProduct.sellingPrice),
      stock: Number(quantity),
      minimumStock: Number(newProduct.minimumStock) || 5,
      unit: newProduct.unit || "pcs",
    }).save();

    await AuditLog.create({
      user: "ADMIN",
      action: "CREATE PRODUCT",
      details: `${createdProduct.name} | Cost Rs.${createdProduct.costPrice} | Sell Rs.${createdProduct.sellingPrice} (via Purchase)`,
    });

    const productId = createdProduct._id;

    const purchase = new Purchase({ supplier, product: productId, quantity, costPrice, invoiceNumber });
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

    await StockMovement.create({
      product: productId,
      type: "PURCHASE",
      quantity,
      note: "Initial stock (via Purchase)",
    });

    // Stock is already set at product creation time (= quantity), so no
    // additional increment is needed here.

    const populatedPurchase = await savedPurchase.populate("product");
    res.status(201).json(populatedPurchase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;