const express = require("express");
const auth = require("../middleware/auth");
const Task = require("../models/Task");
const User = require("../models/User");
const { sendEmail, taskAssignedEmail } = require("../utils/sendEmail");
const multer = require("multer");
const path = require("path");

// Safely require socket
let emitToEmail = () => {};
try {
  const socketUtil = require("../utils/socket");
  if (socketUtil && socketUtil.emitToEmail) {
    emitToEmail = socketUtil.emitToEmail;
  }
} catch (e) {
  // Socket fallback
}

// Dynamic Rank Calculation Helper
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

  // Handle custom dynamic roles relative position
  if (user.role === "other" && user.relation) {
    const refRank = baseRanks[user.relation.referenceRole] ?? 2;
    return user.relation.position === "above" ? refRank + 0.5 : refRank - 0.5;
  }

  return 1;
}

// Multer Config for Files Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/voicemails/");
  },
  filename: (req, file, cb) => {
    cb(null, `voice-${Date.now()}${path.extname(file.originalname || ".webm")}`);
  },
});
const upload = multer({ storage });

const router = express.Router();
router.use(auth);

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

// GET /api/tasks?type=personal|team&sortBy=ai_priority
router.get("/", (req, res) => {
  const { type, sortBy } = req.query;
  let tasks = Task.forUser(req.user.email, req.user.id);

  if (type === "personal" || type === "team") {
    tasks = tasks.filter((t) => t.type === type);
  }

  if (sortBy === "ai_priority") {
    tasks.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  } else {
    tasks.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  }

  res.json({ tasks });
});

// GET /api/tasks/stats
router.get("/stats", (req, res) => {
  const tasks = Task.forUser(req.user.email, req.user.id);
  const now = new Date();

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    pending: tasks.filter((t) => t.status === "pending").length,
    paused: tasks.filter((t) => t.status === "paused").length,
    overdue: tasks.filter(
      (t) => t.status === "pending" && t.dueDate && new Date(t.dueDate) < now
    ).length,
    personal: tasks.filter((t) => t.type === "personal").length,
    team: tasks.filter((t) => t.type === "team").length,
  };

  res.json({ stats });
});

// GET /api/tasks/missed
router.get("/missed", (req, res) => {
  const today = todayStr();
  const tasks = Task.forUser(req.user.email, req.user.id);

  const missed = tasks.filter((t) => {
    if (t.status !== "pending" || !t.dueDate) return false;
    const dueDay = t.dueDate.slice(0, 10);
    if (dueDay >= today) return false;
    if (t.missedNotifiedOn === today) return false;
    return true;
  });

  missed.forEach((t) => Task.update(t.id, { missedNotifiedOn: today }));

  res.json({ missed });
});

// POST /api/tasks -> create task (WITH HIERARCHY DELEGATION GUARD)
router.post("/", upload.single("taskVoiceNote"), async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      assignedEmail,
      ccEmails,
      dueDate,
      reminderMinutesBefore,
      priority,
      effortHours,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Task title is required." });
    }
    
    // Team Task Validation & Hierarchy Protection Check
    if (type === "team") {
      if (!assignedEmail) {
        return res.status(400).json({ message: "A team member's email is required for team tasks." });
      }

      const currentUser = User.findById(req.user.id);
      const targetUser = User.findByEmail(assignedEmail);

      if (!targetUser) {
        return res.status(404).json({ message: "Assigned user email not found." });
      }

      // 1. Cross-Department restriction
      if (currentUser.department !== targetUser.department && currentUser.role !== "Admin") {
        return res.status(403).json({ message: "Cannot assign tasks outside your department." });
      }

      // 2. Hierarchy Rank Restriction Check
      const myRank = getRoleRank(currentUser);
      const targetRank = getRoleRank(targetUser);

      const isExplicitlyAllowed = targetUser.assignableBy && 
        (targetUser.assignableBy.includes(currentUser.role) || targetUser.assignableBy.includes("ALL"));

      if (currentUser.role !== "Admin" && !isExplicitlyAllowed && myRank <= targetRank) {
        return res.status(403).json({ 
          message: `Hierarchy Restriction: You cannot assign tasks to ${targetUser.name} (${targetUser.customRole || targetUser.role}) as they hold an equal or higher level.` 
        });
      }
    }

    const taskVoiceNoteUrl = req.file ? `/uploads/voicemails/${req.file.filename}` : null;

    const task = Task.create({
      title,
      description,
      type,
      ownerId: req.user.id,
      ownerEmail: req.user.email,
      assignedEmail,
      ccEmails,
      dueDate,
      reminderMinutesBefore,
      priority,
      effortHours: effortHours ? Number(effortHours) : 1,
      ...(taskVoiceNoteUrl && { taskVoiceNoteUrl }),
    });

    if (task.type === "team") {
      const assigneeUser = User.findByEmail(task.assignedEmail);
      const { subject, html } = taskAssignedEmail({
        assigneeName: assigneeUser ? assigneeUser.name : "",
        taskTitle: task.title,
        dueDate: task.dueDate,
        assignerName: req.user.name,
      });
      await sendEmail({ to: task.assignedEmail, subject, html });

      emitToEmail(task.assignedEmail, "task:assigned", {
        taskId: task.id,
        title: task.title,
        from: req.user.name,
      });
    }

    res.status(201).json({ task });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred while creating the task." });
  }
});

function canEdit(task, user) {
  if (!task) return false;
  const emailLc = user.email.toLowerCase();
  const isOwner = task.ownerId === user.id;
  const isAssigned = task.assignedEmail && task.assignedEmail.toLowerCase() === emailLc;
  const isCCed = Array.isArray(task.ccEmails) && task.ccEmails.includes(emailLc);

  return isOwner || isAssigned || isCCed;
}

// 1. ADD COMMENT ROUTE
router.post(
  "/:id/comments",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "voiceNote", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const task = Task.findById(req.params.id);
      if (!canEdit(task, req.user)) {
        return res.status(404).json({ message: "Task not found." });
      }

      const messageText = req.body.message || req.body.text || "";

      const imageUrl = req.files?.image
        ? `/uploads/voicemails/${req.files.image[0].filename}`
        : null;
      const voiceUrl = req.files?.voiceNote
        ? `/uploads/voicemails/${req.files.voiceNote[0].filename}`
        : null;

      if (!messageText.trim() && !imageUrl && !voiceUrl) {
        return res
          .status(400)
          .json({ message: "Comment message or media attachment is required." });
      }

      const result = Task.addComment(task.id, {
        senderEmail: req.user.email,
        senderName: req.user.name || req.user.email,
        message: messageText,
        imageUrl,
        voiceUrl,
      });

      res.json({
        message: "Comment added successfully!",
        comment: result.comment,
        task: result.task,
      });
    } catch (err) {
      console.error("Comment Error:", err);
      res.status(500).json({ message: "Error adding comment." });
    }
  }
);

// 2. SIGN-OFF WITH VOICE MAIL ROUTE
router.post("/:id/sign-off", upload.single("voiceMail"), async (req, res) => {
  try {
    const task = Task.findById(req.params.id);
    if (!canEdit(task, req.user)) {
      return res.status(404).json({ message: "Task not found." });
    }

    const voiceMailUrl = req.file ? `/uploads/voicemails/${req.file.filename}` : null;

    const patch = {
      status: "completed",
      completedAt: new Date().toISOString(),
      signedOffBy: req.user.email,
      signedOffAt: new Date().toISOString(),
      signRemarks: req.body.remarks || "",
      ...(voiceMailUrl && { voiceMailUrl }),
    };

    const updatedTask = Task.update(task.id, patch);

    res.json({ message: "Task signed off successfully!", task: updatedTask });
  } catch (err) {
    console.error("Sign-off Error:", err);
    res.status(500).json({ message: "Error signing off task." });
  }
});

// PATCH /api/tasks/:id -> generic update
router.patch("/:id", (req, res) => {
  const task = Task.findById(req.params.id);
  if (!canEdit(task, req.user)) {
    return res.status(404).json({ message: "Task not found." });
  }

  const allowed = ["title", "description", "dueDate", "priority", "reminderMinutesBefore", "effortHours"];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  if (patch.dueDate) patch.reminderSentAt = null;

  const updated = Task.update(task.id, patch);
  res.json({ task: updated });
});

// PATCH /api/tasks/:id/complete -> toggle complete
router.patch("/:id/complete", (req, res) => {
  const task = Task.findById(req.params.id);
  if (!canEdit(task, req.user)) {
    return res.status(404).json({ message: "Task not found." });
  }
  const nowCompleted = task.status !== "completed";
  const updated = Task.update(task.id, {
    status: nowCompleted ? "completed" : "pending",
    completedAt: nowCompleted ? new Date().toISOString() : null,
  });
  res.json({ task: updated });
});

// PATCH /api/tasks/:id/pause -> pause
router.patch("/:id/pause", (req, res) => {
  const task = Task.findById(req.params.id);
  if (!canEdit(task, req.user)) {
    return res.status(404).json({ message: "Task not found." });
  }
  const updated = Task.update(task.id, { status: "paused" });
  res.json({ task: updated });
});

// PATCH /api/tasks/:id/resume -> resume
router.patch("/:id/resume", (req, res) => {
  const task = Task.findById(req.params.id);
  if (!canEdit(task, req.user)) {
    return res.status(404).json({ message: "Task not found." });
  }
  const updated = Task.update(task.id, { status: "pending", reminderSentAt: null });
  res.json({ task: updated });
});

// DELETE /api/tasks/:id -> only owner
router.delete("/:id", (req, res) => {
  const task = Task.findById(req.params.id);
  if (!task || task.ownerId !== req.user.id) {
    return res.status(404).json({ message: "Task not found." });
  }
  Task.remove(task.id);
  res.json({ message: "Task deleted successfully." });
});

module.exports = router;