const express  = require("express");
const router   = express.Router();

const Supplier = require("../models/Supplier");
const auth     = require("../middleware/auth");
const admin    = require("../middleware/admin");

// GET /suppliers?page=1&limit=15&search=
router.get("/", async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.max(1, parseInt(req.query.limit) || 15);
    const skip   = (page - 1) * limit;
    const search = req.query.search?.trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { name:    { $regex: search, $options: "i" } },
        { phone:   { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { notes:   { $regex: search, $options: "i" } },
      ];
    }

    const [suppliers, totalCount] = await Promise.all([
      Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Supplier.countDocuments(filter),
    ]);

    res.json({
      suppliers,
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /suppliers/all  — unpaginated, used by Purchases dropdown
router.get("/all", async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /suppliers
router.post("/", auth, admin, async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;
    const supplier = new Supplier({ name, phone, address, notes });
    const savedSupplier = await supplier.save();
    res.status(201).json(savedSupplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /suppliers/:id
router.delete("/:id", auth, admin, async (req, res) => {
  try {
    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ message: "Supplier deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;