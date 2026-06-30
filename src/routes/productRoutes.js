const express = require("express");
const router = express.Router();

const Product = require("../models/Product");
const AuditLog = require("../models/AuditLog");
const upload = require("../middleware/upload");
const auth = require("../middleware/auth");

const admin = require("../middleware/admin");

router.get("/all", async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ name: 1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;

    const products = await Product.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalProducts = await Product.countDocuments();

    const allProducts = await Product.find();

    const lowStockItems = allProducts.filter(
      (p) => Number(p.stock) <= Number(p.minimumStock)
    ).length;

    const inventoryValue = allProducts.reduce(
      (total, product) =>
        total + Number(product.costPrice) * Number(product.stock),
      0
    );

    res.json({
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),

      totalProducts,
      lowStockItems,
      inventoryValue,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

router.post("/", auth, admin, upload.single("image"), async (req, res) => {
  try {
    const {
      name,
      category,
      barcode,
      costPrice,
      sellingPrice,
      stock,
      minimumStock,
      unit,
    } = req.body;

    const image = req.file ? `/uploads/${req.file.filename}` : "";

    const product = new Product({
      name,
      category,
      barcode,
      image,
      costPrice,
      sellingPrice,
      stock,
      minimumStock,
      unit,
    });

    const savedProduct = await product.save();

    await AuditLog.create({
      user: "ADMIN",
      action: "CREATE PRODUCT",
      details: `${savedProduct.name} | Cost Rs.${savedProduct.costPrice} | Sell Rs.${savedProduct.sellingPrice}`,
    });

    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Delete Product
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Update Product
router.put("/:id", auth, admin, async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
      },
    );

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
