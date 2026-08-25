const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    sapId: { type: String, default: "" },
    role: { type: String, default: null },
    customRole: { type: String, default: "" },
    relation: { type: mongoose.Schema.Types.Mixed, default: null },
    department: { type: String, default: null },
    assignableBy: { type: [String], default: [] },
    resetOTP: { type: String, default: null },
    resetOTPExpires: { type: String, default: null },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);

// ---- Helper functions matching the old db.json-based API ----

function toApiShape(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return { ...obj, id: obj._id.toString() };
}

async function findByEmail(email) {
  const doc = await UserModel.findOne({ email: String(email).toLowerCase() });
  return toApiShape(doc);
}

async function findById(id) {
  try {
    const doc = await UserModel.findById(id);
    return toApiShape(doc);
  } catch (err) {
    return null; // invalid ObjectId
  }
}

async function createUser({
  name,
  email,
  passwordHash,
  sapId = "",
  role = null,
  customRole = "",
  relation = null,
  department = null,
  assignableBy = [],
}) {
  const doc = await UserModel.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    sapId,
    role,
    customRole: role === "other" ? customRole : "",
    relation: role === "other" ? relation : null,
    department,
    assignableBy,
  });
  return toApiShape(doc);
}

async function updateProfile(userId, { role, customRole, relation, department, sapId }) {
  const update = {};
  if (role !== undefined) update.role = role;
  update.customRole = role === "other" ? customRole : "";
  update.relation = role === "other" ? relation : null;
  if (department !== undefined) update.department = department;
  if (sapId !== undefined) update.sapId = sapId;

  const doc = await UserModel.findByIdAndUpdate(userId, update, { new: true });
  return toApiShape(doc);
}

async function findByDepartment(department) {
  if (!department) return [];
  const docs = await UserModel.find({
    department: new RegExp(`^${department}$`, "i"),
  });
  return docs.map(toApiShape);
}

async function saveOTP(userId, otp, expiresAt) {
  const doc = await UserModel.findByIdAndUpdate(
    userId,
    { resetOTP: otp, resetOTPExpires: expiresAt },
    { new: true }
  );
  return toApiShape(doc);
}

async function updatePasswordWithOTP(email, otp, newPasswordHash) {
  const now = new Date().toISOString();
  const doc = await UserModel.findOne({
    email: String(email).toLowerCase(),
    resetOTP: otp,
    resetOTPExpires: { $gt: now },
  });

  if (!doc) return null;

  doc.passwordHash = newPasswordHash;
  doc.resetOTP = null;
  doc.resetOTPExpires = null;
  await doc.save();
  return toApiShape(doc);
}

function toPublic(user) {
  if (!user) return null;
  const { passwordHash, resetOTP, resetOTPExpires, ...rest } = user;
  return rest;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateProfile,
  findByDepartment,
  saveOTP,
  updatePasswordWithOTP,
  toPublic,
};