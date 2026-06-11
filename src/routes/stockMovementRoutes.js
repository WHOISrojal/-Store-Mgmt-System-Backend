const express = require("express");
const router = express.Router();

const StockMovement = require("../models/StockMovement");

// Get Product Stock History
router.get("/:productId", async (req, res) => {
  try {
    const movements = await StockMovement.find({
      product: req.params.productId,
    })
      .populate("product")
      .sort({ createdAt: -1 });

    res.json(movements);

  } catch (error) {

    res.status(500).json({
      message: error.message,
    });

  }
});

module.exports = router;