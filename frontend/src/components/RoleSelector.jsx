import React, { useState, useEffect } from "react";

export const BANK_DEPARTMENTS = [
  "Information Technology Group (ITG)",
  "Digital Banking & Operations",
  "Retail Banking",
  "Corporate & Investment Banking",
  "Risk Management",
  "Finance & Accounts",
  "Human Resources (HR)",
  "Compliance & Legal",
  "Audit & Inspection",
  "Other",
];

export const HIERARCHY_ROLES = [
  { id: "business_head", label: "Business Head / Group Head", level: 1 },
  { id: "division_head", label: "Division Head", level: 2 },
  { id: "wing_head", label: "Wing Head", level: 3 },
  { id: "team_lead", label: "Team Lead / Line Manager", level: 4 },
  { id: "team_member", label: "Team Member / Officer", level: 5 },
  { id: "intern", label: "Intern / Trainee", level: 6 },
  { id: "other", label: "Other (Custom Designation)", level: 99 },
];

export function resolveRoleLevel(roleId, customRoleName = "", relativeRelation = null) {
  if (roleId !== "other") {
    const found = HIERARCHY_ROLES.find((r) => r.id === roleId);
    return found ? found.level : 5;
  }

  const name = customRoleName.toLowerCase().trim();

  if (relativeRelation && relativeRelation.referenceRole) {
    const refRole = HIERARCHY_ROLES.find((r) => r.id === relativeRelation.referenceRole);
    if (refRole) {
      return relativeRelation.position === "below" ? refRole.level + 0.5 : refRole.level - 0.5;
    }
  }

  if (name.includes("head") || name.includes("director") || name.includes("president") || name.includes("vp")) {
    if (name.includes("group") || name.includes("business")) return 1;
    if (name.includes("division") || name.includes("evp") || name.includes("svp")) return 2;
    if (name.includes("wing") || name.includes("avp") || name.includes("vp")) return 3;
    return 3;
  }

  if (name.includes("manager") || name.includes("lead") || name.includes("supervisor")) {
    return 4;
  }

  if (name.includes("officer") || name.includes("executive") || name.includes("analyst")) {
    return 5;
  }

  if (name.includes("intern") || name.includes("trainee")) {
    return 6;
  }

  return 5;
}

export default function RoleSelector({ value, onChange }) {
  const [role, setRole] = useState(value?.role || "team_member");
  const [customRole, setCustomRole] = useState(value?.customRole || "");
  const [relPosition, setRelPosition] = useState(value?.relation?.position || "below");
  const [refRole, setRefRole] = useState(value?.relation?.referenceRole || "wing_head");

  useEffect(() => {
    const relation = role === "other" ? { position: relPosition, referenceRole: refRole } : null;
    onChange({ role, customRole, relation });
  }, [role, customRole, relPosition, refRole]);

  const autoDetectedLevel = resolveRoleLevel(role, customRole, { position: relPosition, referenceRole: refRole });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Designation / Role</label>
      
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
      >
        {HIERARCHY_ROLES.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>

      {role === "other" && (
        <div style={{ padding: "12px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
          <input
            type="text"
            placeholder="e.g., Line Manager, Senior Analyst"
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "14px", marginBottom: "10px" }}
          />

          <div style={{ fontSize: "12px", color: "#4b5563", marginBottom: "6px" }}>
            📍 <strong>Hierarchy Placement:</strong> Where does this position sit?
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              value={relPosition}
              onChange={(e) => setRelPosition(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }}
            >
              <option value="below">Is Below 👇</option>
              <option value="above">Is Above 👆</option>
            </select>

            <select
              value={refRole}
              onChange={(e) => setRefRole(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "12px" }}
            >
              {HIERARCHY_ROLES.filter((r) => r.id !== "other").map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "8px", fontStyle: "italic" }}>
            💡 Calculated Hierarchy Level: {autoDetectedLevel}
          </div>
        </div>
      )}
    </div>
  );
}