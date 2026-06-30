const express = require("express");
const router  = express.Router();

const StockMovement = require("../models/StockMovement");
const Product       = require("../models/Product");

/* ── Stats (must be before /:productId so it doesn't clash) ── */
router.get("/stats", async (req, res) => {
  try {
    const [
      total, purchases, sales, returns, adjustments,
      stockInAgg, stockOutAgg,
    ] = await Promise.all([
      StockMovement.countDocuments(),
      StockMovement.countDocuments({ type: "PURCHASE" }),
      StockMovement.countDocuments({ type: "SALE" }),
      StockMovement.countDocuments({ type: "RETURN" }),
      StockMovement.countDocuments({ type: "ADJUSTMENT" }),
      StockMovement.aggregate([
        { $match: { type: { $in: ["PURCHASE", "RETURN"] } } },
        { $group: { _id: null, total: { $sum: "$quantity" } } },
      ]),
      StockMovement.aggregate([
        { $match: { type: "SALE" } },
        { $group: { _id: null, total: { $sum: "$quantity" } } },
      ]),
    ]);

    res.json({
      total,
      purchases,
      sales,
      returns,
      adjustments,
      totalIn:  stockInAgg[0]?.total  || 0,
      totalOut: stockOutAgg[0]?.total || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ── All movements — paginated ────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 15);
    const skip  = (page - 1) * limit;
    const type  = req.query.type;
    const search = req.query.search?.trim();

    /* build filter */
    const filter = {};

    if (type && type !== "ALL") {
      filter.type = type;
    }

    if (search) {
      /* find products whose name matches the search term */
      const matchingProducts = await Product.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");

      filter.$or = [
        { product: { $in: matchingProducts.map(p => p._id) } },
        { note: { $regex: search, $options: "i" } },
      ];
    }

    const [movements, totalCount] = await Promise.all([
      StockMovement.find(filter)
        .populate("product")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(filter),
    ]);

    res.json({
      movements,
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ── Single product stock history ─────────────────────────── */
router.get("/:productId", async (req, res) => {
  try {
    const movements = await StockMovement.find({
      product: req.params.productId,
    })
      .populate("product")
      .sort({ createdAt: -1 });

    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;