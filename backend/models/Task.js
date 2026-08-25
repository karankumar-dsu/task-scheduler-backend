const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    senderEmail: String,
    senderName: String,
    message: String,
    imageUrl: { type: String, default: null },
    voiceUrl: { type: String, default: null },
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["personal", "team"], default: "personal" },
    ownerId: { type: String, required: true },
    ownerEmail: { type: String, required: true },
    assignedEmail: { type: String, default: null },
    ccEmails: { type: [String], default: [] },
    dueDate: { type: String, default: null },
    reminderMinutesBefore: { type: Number, default: 30 },

    effortHours: { type: Number, default: 1 },
    priority: { type: String, default: "medium" },
    priorityScore: { type: Number, default: 0 },

    status: { type: String, enum: ["pending", "completed", "paused"], default: "pending" },
    reminderSentAt: { type: String, default: null },
    missedNotifiedOn: { type: String, default: null },

    comments: { type: [commentSchema], default: [] },
    signedOffBy: { type: String, default: null },
    signedOffAt: { type: String, default: null },
    signRemarks: { type: String, default: "" },
    voiceMailUrl: { type: String, default: null },

    completedAt: { type: String, default: null },
  },
  { timestamps: true }
);

const TaskModel = mongoose.model("Task", taskSchema);

// ---- Priority score engine (unchanged logic) ----
function computePriorityScore(dueDate, effortHours = 1, priority = "medium") {
  let score = 0;

  if (dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const hoursLeft = (due - now) / (1000 * 60 * 60);

    if (hoursLeft <= 0) score += 50;
    else if (hoursLeft <= 24) score += 45;
    else if (hoursLeft <= 72) score += 30;
    else score += 15;
  } else {
    score += 5;
  }

  const effort = Number(effortHours) || 1;
  if (effort >= 8) score += 25;
  else if (effort >= 4) score += 15;
  else score += 5;

  const prio = String(priority).toLowerCase();
  if (prio === "high") score += 25;
  else if (prio === "medium") score += 15;
  else score += 5;

  return Math.min(score, 100);
}

function toApiShape(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  const comments = (obj.comments || []).map((c) => ({
    ...c,
    id: c._id ? c._id.toString() : c.id,
  }));
  return { ...obj, id: obj._id.toString(), comments };
}

async function all() {
  const docs = await TaskModel.find();
  return docs.map(toApiShape);
}

async function create(task) {
  const ccEmails = Array.isArray(task.ccEmails)
    ? task.ccEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
    : typeof task.ccEmails === "string"
    ? task.ccEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : [];

  const effortHours = task.effortHours ? Number(task.effortHours) : 1;
  const basePriority = task.priority || "medium";
  const priorityScore = computePriorityScore(task.dueDate, effortHours, basePriority);

  const doc = await TaskModel.create({
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
    effortHours,
    priority: basePriority,
    priorityScore,
    status: "pending",
    voiceMailUrl: task.taskVoiceNoteUrl || task.voiceMailUrl || null,
  });

  return toApiShape(doc);
}

async function findById(id) {
  try {
    const doc = await TaskModel.findById(id);
    return toApiShape(doc);
  } catch (err) {
    return null;
  }
}

async function update(id, patch) {
  const existing = await TaskModel.findById(id);
  if (!existing) return null;

  let updatedCcEmails = existing.ccEmails || [];
  if (patch.ccEmails !== undefined) {
    updatedCcEmails = Array.isArray(patch.ccEmails)
      ? patch.ccEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)
      : typeof patch.ccEmails === "string"
      ? patch.ccEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
      : [];
  }

  const updatedDueDate = patch.dueDate !== undefined ? patch.dueDate : existing.dueDate;
  const updatedEffort =
    patch.effortHours !== undefined ? Number(patch.effortHours) : existing.effortHours;
  const updatedPriority = patch.priority !== undefined ? patch.priority : existing.priority;

  const priorityScore = computePriorityScore(updatedDueDate, updatedEffort, updatedPriority);

  Object.assign(existing, patch, {
    ccEmails: updatedCcEmails,
    effortHours: updatedEffort,
    priorityScore,
  });

  await existing.save();
  return toApiShape(existing);
}

async function addComment(id, comment) {
  const existing = await TaskModel.findById(id);
  if (!existing) return null;

  const newComment = {
    senderEmail: comment.senderEmail,
    senderName: comment.senderName,
    message: comment.message,
    imageUrl: comment.imageUrl || null,
    voiceUrl: comment.voiceUrl || null,
    createdAt: new Date().toISOString(),
  };

  existing.comments.push(newComment);
  await existing.save();

  const savedTask = toApiShape(existing);
  const savedComment = savedTask.comments[savedTask.comments.length - 1];

  return { task: savedTask, comment: savedComment };
}

async function remove(id) {
  const result = await TaskModel.findByIdAndDelete(id);
  return !!result;
}

async function forUser(email, userId) {
  const emailLc = String(email).toLowerCase();
  const docs = await TaskModel.find({
    $or: [
      { ownerId: userId },
      { assignedEmail: emailLc },
      { ccEmails: emailLc },
    ],
  });
  return docs.map(toApiShape);
}

module.exports = { all, create, findById, update, addComment, remove, forUser, computePriorityScore };