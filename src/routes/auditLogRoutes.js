const express = require("express");
const router  = express.Router();

const AuditLog = require("../models/AuditLog");
const auth     = require("../middleware/auth");
const admin    = require("../middleware/admin");

// GET /audit-logs?page=1&limit=20&search=&action=
router.get("/", auth, admin, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.max(1, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const search = req.query.search?.trim();
    const action = req.query.action; // e.g. "CREATE", "DELETE" etc.

    const filter = {};

    if (action && action !== "ALL") {
      filter.action = { $regex: action, $options: "i" };
    }

    if (search) {
      filter.$or = [
        { user:    { $regex: search, $options: "i" } },
        { action:  { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];
    }

    const [logs, totalCount] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stats endpoint for filter counts & stat cards
router.get("/stats", auth, admin, async (req, res) => {
  try {
    const [total, creates, deletes, updates, restores, resets, uniqueUsers] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ action: { $regex: "CREATE",  $options: "i" } }),
      AuditLog.countDocuments({ action: { $regex: "DELETE",  $options: "i" } }),
      AuditLog.countDocuments({ action: { $regex: "UPDATE",  $options: "i" } }),
      AuditLog.countDocuments({ action: { $regex: "RESTORE", $options: "i" } }),
      AuditLog.countDocuments({ action: { $regex: "RESET",   $options: "i" } }),
      AuditLog.distinct("user"),
    ]);

    res.json({
      total, creates, deletes, updates, restores, resets,
      uniqueUsers: uniqueUsers.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;