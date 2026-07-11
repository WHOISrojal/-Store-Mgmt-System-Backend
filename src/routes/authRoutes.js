const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const User = require("../models/User");


// ======================================
// Check Setup Status
// ======================================
router.get("/setup-status", async (req, res) => {
  try {
    const userCount = await User.countDocuments();

    res.json({
      initialized: userCount > 0,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});


// ======================================
// First Time Setup
// Creates first ADMIN only if no users exist
// ======================================
router.post("/setup", async (req, res) => {
  try {
    const userCount = await User.countDocuments();

    if (userCount > 0) {
      return res.status(400).json({
        message: "System already initialized",
      });
    }

    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username,
      password: hashedPassword,
      role: "ADMIN",
    });

    await user.save();

    res.status(201).json({
      message: "Administrator created successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});


// ======================================
// Register User (ADMIN ONLY)
// ======================================
router.post("/register", auth, admin, async (req, res) => {
  try {
    const { name, username, password, role } = req.body;

    const existingUser = await User.findOne({
      username,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username,
      password: hashedPassword,
      role,
    });

    await user.save();

    res.status(201).json({
      message: "User created successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});


// ======================================
// Login
// ======================================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({
      username,
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid username",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.json({
      token,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;