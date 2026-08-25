const { v4: uuidv4 } = require("uuid");
const { readDb, writeDb } = require("../data/db");

function findByEmail(email) {
  const db = readDb();
  return db.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
  );
}

function findById(id) {
  const db = readDb();
  return db.users.find((u) => u.id === id);
}

function createUser({
  name,
  email,
  passwordHash,
  sapId = "", // Added SAP ID field
  role = null,
  customRole = "",
  relation = null,
  department = null,
  assignableBy = [],
}) {
  const db = readDb();
  const user = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    passwordHash,
    sapId, // Store SAP ID here
    role, 
    customRole: role === "other" ? customRole : "", 
    relation: role === "other" ? relation : null, 
    department, 
    assignableBy, 
    resetOTP: null,
    resetOTPExpires: null,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDb(db);
  return user;
}

// Update Role, Custom Role, Relation, Department and SAP ID for Onboarding Profile Setup
function updateProfile(userId, { role, customRole, relation, department, sapId }) {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.role = role !== undefined ? role : user.role;
    user.customRole = role === "other" ? customRole : "";
    user.relation = role === "other" ? relation : null;
    user.department = department !== undefined ? department : user.department;
    user.sapId = sapId !== undefined ? sapId : user.sapId; // Update SAP ID if provided
    writeDb(db);
  }
  return user;
}

// Find all team members belonging to the same department
function findByDepartment(department) {
  const db = readDb();
  if (!department) return [];
  return db.users.filter(
    (u) => u.department && u.department.toLowerCase() === department.toLowerCase()
  );
}

// Save OTP to DB
function saveOTP(userId, otp, expiresAt) {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.resetOTP = otp;
    user.resetOTPExpires = expiresAt;
    writeDb(db);
  }
  return user;
}

// Verify OTP & Update Password
function updatePasswordWithOTP(email, otp, newPasswordHash) {
  const db = readDb();
  const now = new Date().toISOString();

  const user = db.users.find(
    (u) =>
      u.email.toLowerCase() === String(email).toLowerCase() &&
      u.resetOTP === otp &&
      u.resetOTPExpires > now
  );

  if (!user) return null;

  user.passwordHash = newPasswordHash;
  user.resetOTP = null;
  user.resetOTPExpires = null;
  writeDb(db);
  return user;
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