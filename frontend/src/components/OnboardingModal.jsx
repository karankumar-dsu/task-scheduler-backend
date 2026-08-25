import { useState } from "react";
import axios from "../api/axios";
import RoleSelector from "./RoleSelector";

export default function OnboardingModal({ user, onComplete }) {
  const [roleData, setRoleData] = useState({
    role: "",
    customRole: "",
    relation: null,
  });
  const [department, setDepartment] = useState("");
  const [customDepartment, setCustomDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const departmentsList = [
    "IT Operations",
    "Application Development",
    "Core Banking",
    "Cyber Security",
    "Infrastructure & Networks",
    "Other",
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const selectedDept = department === "Other" ? customDepartment : department;

    if (!roleData.role || !selectedDept) {
      setError("Please select both Role and Department.");
      return;
    }

    if (roleData.role === "other" && !roleData.customRole.trim()) {
      setError("Please enter your custom role name.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.put("/auth/setup-profile", {
        role: roleData.role,
        customRole: roleData.customRole,
        relation: roleData.relation,
        department: selectedDept,
      });

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
      }

      onComplete(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div className="auth-card" style={{ maxWidth: "480px", width: "90%", margin: 0 }}>
        <div className="auth-brand">
          <span className="mark" />
          <h1>Complete Profile</h1>
        </div>
        <p className="auth-sub">
          Welcome, <strong>{user?.name}</strong>! Please select your organization role and department to continue.
        </p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Smart Hierarchy Role Selector */}
          <div className="field">
            <RoleSelector value={roleData} onChange={setRoleData} />
          </div>

          {/* Department Selection */}
          <div className="field" style={{ marginTop: "15px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Select Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
            >
              <option value="">-- Choose Department --</option>
              {departmentsList.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {department === "Other" && (
            <div className="field" style={{ marginTop: "15px" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Enter Department Name</label>
              <input
                type="text"
                placeholder="e.g. Finance IT"
                value={customDepartment}
                onChange={(e) => setCustomDepartment(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #ccc", marginTop: "4px" }}
              />
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: "20px", width: "100%" }}
          >
            {loading ? "Saving..." : "Save & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}