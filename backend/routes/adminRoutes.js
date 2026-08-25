const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware"); // Apka JWT middleware
const { Task, User } = require("../models"); // Apka Database Model (Prisma / Sequelize)

// 1. GET ALL TASKS (Admin Only)
router.get("/tasks", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }
    const tasks = await Task.findAll({ order: [["createdAt", "DESC"]] });
    res.json({ tasks });
  } catch (err) {
    console.error("Admin fetch tasks error:", err);
    res.status(500).json({ message: "Failed to fetch admin tasks." });
  }
});

// 2. ADD NEW MEMBER (Admin Only)
router.post("/add-member", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }
    const { name, email, password, role, department } = req.body;

    // Check existing user
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "User with this email already exists." });
    }

    // Note: Use bcrypt for hashing password if needed
    const newUser = await User.create({
      name,
      email,
      password, // Send hashed password or use model hooks
      role,
      department,
    });

    res.status(201).json({ message: "Member created successfully.", user: newUser });
  } catch (err) {
    console.error("Admin add member error:", err);
    res.status(500).json({ message: "Failed to create user." });
  }
});

module.exports = router;