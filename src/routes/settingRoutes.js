const express = require("express");
const router = express.Router();

const Setting = require("../models/Setting");
const auth = require("../middleware/auth");

const admin = require("../middleware/admin");

// Get Settings
router.get("/", async (req, res) => {
  try {
    let setting = await Setting.findOne();

    if (!setting) {
      setting = await Setting.create({});
    }

    res.json(setting);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Update Settings
router.put("/", auth, admin, async (req, res) => {
  try {
    let setting = await Setting.findOne();

    if (!setting) {
      setting = await Setting.create({});
    }

    setting.storeName = req.body.storeName;

    setting.address = req.body.address;

    setting.phone = req.body.phone;

    setting.vatNumber = req.body.vatNumber;

    await setting.save();

    res.json(setting);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
