import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);

      // Routing logic based on onboarding and roles
      if (!user?.department || !user?.role) {
        navigate("/onboarding");
      } else if (user?.role === "Admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Login Error Details:", err);
      // Agar backend se koi specific message aa raha hai toh wo dikhayein, nahi toh standard error
      const errorMsg = err.response?.data?.message || err.message || "Unable to log in. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark" />
          <h1>Task Scheduler</h1>
        </div>
        <p className="auth-sub">Personal and team tasks, all in one place.</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {/* --- Forgot Password Link --- */}
        <div style={{ textAlign: "center", marginTop: "15px", marginBottom: "5px" }}>
          <Link to="/forgot-password" style={{ fontSize: "14px", fontWeight: "500", color: "#666", textDecoration: "none" }}>
            Forgot Password?
          </Link>
        </div>

        <div className="auth-switch">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>

        <div className="auth-credit">Built by Karan Jaseja</div>
      </div>
    </div>
  );
} 