const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { sendEmail, otpEmail } = require("../utils/sendEmail");

const router = express.Router();

// Helper to resolve rank numerical score for relative comparison
function getRoleRank(user) {
  if (!user) return 0;

  const baseRanks = {
    "Admin": 5,
    "Division Head": 4,
    "Wing Head": 3,
    "Team Lead": 2,
    "Team Member": 1,
    "Intern": 0,
  };

  if (baseRanks[user.role] !== undefined) {
    return baseRanks[user.role];
  }

  if (user.role === "other" && user.relation) {
    const refRank = baseRanks[user.relation.referenceRole] ?? 2;
    return user.relation.position === "above" ? refRank + 0.5 : refRank - 0.5;
  }

  return 1;
}

function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      sapId: user.sapId || null,
      role: user.role || null,
      customRole: user.customRole || null,
      department: user.department || null,
    },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "7d" }
  );
}

// 1. REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, sapId } = req.body;

    if (!name || !email || !password || !sapId) {
      return res.status(400).json({ message: "Name, email, password, and SAP ID are required." });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.createUser({ name, email, passwordHash, sapId });
    const token = makeToken(user);

    res.status(201).json({ token, user: User.toPublic(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// 2. LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email || "");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const ok = await bcrypt.compare(password || "", user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = makeToken(user);
    res.json({ token, user: User.toPublic(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during login." });
  }
});

// 3. GET CURRENT USER
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user: User.toPublic(user) });
});

// 4. SETUP PROFILE / ONBOARDING
const handleProfileSetup = async (req, res) => {
  try {
    const { role, customRole, relation, department, sapId } = req.body;
    if (!role || !department) {
      return res.status(400).json({ message: "Role and department are required." });
    }

    const profileData = {
      role,
      customRole: role === "other" ? customRole : "",
      relation: role === "other" ? relation : null,
      department,
      sapId: sapId || undefined,
    };

    const updatedUser = await User.updateProfile(req.user.id, profileData);
    const newToken = makeToken(updatedUser);

    res.json({
      token: newToken,
      user: User.toPublic(updatedUser),
      message: "Profile setup completed successfully.",
    });
  } catch (err) {
    console.error("Setup Profile Error:", err);
    res.status(500).json({ message: "Server error setting up profile." });
  }
};

router.put("/setup-profile", auth, handleProfileSetup);
router.put("/onboarding", auth, handleProfileSetup);

// 5. GET DEPARTMENT TEAM MEMBERS
router.get("/team-members", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || !currentUser.department) {
      return res.status(400).json({ message: "User department not configured." });
    }

    const currentUserRank = getRoleRank(currentUser);
    const members = await User.findByDepartment(currentUser.department);

    const allowedMembers = members.filter((m) => {
      if (m.id === currentUser.id) return false;
      if (currentUser.role === "Admin") return true;

      if (m.assignableBy && Array.isArray(m.assignableBy)) {
        if (m.assignableBy.includes(currentUser.role) || m.assignableBy.includes("ALL")) {
          return true;
        }
      }

      const memberRank = getRoleRank(m);
      return currentUserRank > memberRank;
    });

    const publicMembers = allowedMembers.map((m) => User.toPublic(m));
    res.json({ members: publicMembers });
  } catch (err) {
    console.error("Team Members Error:", err);
    res.status(500).json({ message: "Server error fetching team members." });
  }
});

// 6. ADMIN ONLY: CREATE NEW MEMBER DIRECTLY
router.post("/add-member", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.role !== "Admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    const { name, email, password, role, customRole, relation, department, assignableBy, sapId } = req.body;
    if (!name || !email || !password || !role || !department) {
      return res.status(400).json({ message: "All required fields must be provided." });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.createUser({
      name,
      email,
      passwordHash,
      sapId: sapId || "",
      role,
      customRole: role === "other" ? customRole : "",
      relation: role === "other" ? relation : null,
      department,
      assignableBy: assignableBy || [],
    });

    res.status(201).json({ message: "New member added successfully.", user: User.toPublic(newUser) });
  } catch (err) {
    console.error("Add Member Error:", err);
    res.status(500).json({ message: "Server error adding member." });
  }
});

// 7. FORGOT PASSWORD - SEND OTP
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found with this email." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await User.saveOTP(user.id, otp, expiresAt);

    const emailData = otpEmail({ name: user.name, otp });
    await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    res.json({ message: "OTP aapki email par bhej diya gaya hai." });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error while sending OTP." });
  }
});

// 8. RESET PASSWORD - VERIFY OTP & UPDATE
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long." });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await User.updatePasswordWithOTP(email, otp, newPasswordHash);

    if (!updatedUser) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    res.json({ message: "Password reset successful! Ab login kar sakte hain." });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error while resetting password." });
  }
});

module.exports = router;