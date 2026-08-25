const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../data/db");

// AI/Heuristic Prioritization Engine Score Calculator (0-100)
function computePriorityScore(dueDate, effortHours = 1, priority = "medium") {
  let score = 0;

  // 1. Due Date Urgency Weightage (Max 50 points)
  if (dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const hoursLeft = (due - now) / (1000 * 60 * 60);

    if (hoursLeft <= 0) {
      score += 50; // Overdue tasks get highest urgency
    } else if (hoursLeft <= 24) {
      score += 45; // Due within 24 hours
    } else if (hoursLeft <= 72) {
      score += 30; // Due within 3 days
    } else {
      score += 15;
    }
  } else {
    score += 5; // No due date
  }

  // 2. Effort Weightage (Max 25 points)
  const effort = Number(effortHours) || 1;
  if (effort >= 8) score += 25;
  else if (effort >= 4) score += 15;
  else score += 5;

  // 3. User Base Priority Weightage (Max 25 points)
  const prio = String(priority).toLowerCase();
  if (prio === "high") score += 25;
  else if (prio === "medium") score += 15;
  else score += 5;

  return Math.min(score, 100);
}

function all() {
  return readDb().tasks;
}

function create(task) {
  const db = readDb();
  
  // Format CC emails array cleanly
  const ccEmails = Array.isArray(task.ccEmails)
    ? task.ccEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
    : typeof task.ccEmails === "string"
    ? task.ccEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : [];

  const effortHours = task.effortHours ? Number(task.effortHours) : 1;
  const basePriority = task.priority || "medium";
  
  // Calculate AI Score
  const priorityScore = computePriorityScore(task.dueDate, effortHours, basePriority);

  const newTask = {
    id: uuidv4(),
    title: task.title,
    description: task.description || "",
    type: task.type === "team" ? "team" : "personal",
    ownerId: task.ownerId,
    ownerEmail: task.ownerEmail,
    assignedEmail: task.type === "team" ? task.assignedEmail : task.ownerEmail,
    ccEmails: task.type === "team" ? ccEmails : [],
    dueDate: task.dueDate || null,
    reminderMinutesBefore:
      task.reminderMinutesBefore != null ? Number(task.reminderMinutesBefore) : 30,
    
    // AI Engine fields
    effortHours,
    priority: basePriority,
    priorityScore, // AI Computed Dynamic Score (0 - 100)

    status: "pending", // pending | completed | paused
    reminderSentAt: null,
    missedNotifiedOn: null,
    
    // Comments/Queries, Sign-off & Voice Mail
    comments: [],
    signedOffBy: null,
    signedOffAt: null,
    signRemarks: "",
    voiceMailUrl: task.taskVoiceNoteUrl || task.voiceMailUrl || null,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  db.tasks.push(newTask);
  writeDb(db);
  return newTask;
}

function findById(id) {
  return readDb().tasks.find((t) => t.id === id);
}

function update(id, patch) {
  const db = readDb();
  const idx = db.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  let updatedCcEmails = db.tasks[idx].ccEmails || [];
  if (patch.ccEmails !== undefined) {
    updatedCcEmails = Array.isArray(patch.ccEmails)
      ? patch.ccEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
      : typeof patch.ccEmails === "string"
      ? patch.ccEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      : [];
  }

  // Recalculate AI score if relevant fields change
  const updatedDueDate = patch.dueDate !== undefined ? patch.dueDate : db.tasks[idx].dueDate;
  const updatedEffort = patch.effortHours !== undefined ? Number(patch.effortHours) : db.tasks[idx].effortHours;
  const updatedPriority = patch.priority !== undefined ? patch.priority : db.tasks[idx].priority;
  
  const priorityScore = computePriorityScore(updatedDueDate, updatedEffort, updatedPriority);

  db.tasks[idx] = {
    ...db.tasks[idx],
    ...patch,
    ccEmails: updatedCcEmails,
    effortHours: updatedEffort,
    priorityScore,
    updatedAt: new Date().toISOString(),
  };

  writeDb(db);
  return db.tasks[idx];
}

function addComment(id, comment) {
  const db = readDb();
  const idx = db.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const existingComments = db.tasks[idx].comments || [];
  const newComment = {
    id: uuidv4(),
    senderEmail: comment.senderEmail,
    senderName: comment.senderName,
    message: comment.message,
    createdAt: new Date().toISOString(),
  };

  db.tasks[idx].comments = [...existingComments, newComment];
  db.tasks[idx].updatedAt = new Date().toISOString();

  writeDb(db);
  return { task: db.tasks[idx], comment: newComment };
}

function remove(id) {
  const db = readDb();
  const before = db.tasks.length;
  db.tasks = db.tasks.filter((t) => t.id !== id);
  writeDb(db);
  return db.tasks.length < before;
}

function forUser(email, userId) {
  const emailLc = String(email).toLowerCase();
  return readDb().tasks.filter((t) => {
    const isOwner = t.ownerId === userId;
    const isAssigned = t.assignedEmail && t.assignedEmail.toLowerCase() === emailLc;
    const isCCed = Array.isArray(t.ccEmails) && t.ccEmails.includes(emailLc);

    return isOwner || isAssigned || isCCed;
  });
}

module.exports = { all, create, findById, update, addComment, remove, forUser, computePriorityScore };