const express = require("express");
const router = express.Router();

const AuditLog = require("../models/AuditLog");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

// Get Logs
router.get("/", auth, admin, async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
