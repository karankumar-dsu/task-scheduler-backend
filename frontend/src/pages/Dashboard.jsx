import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import TaskCard from "../components/TaskCard";
import TaskForm from "../components/TaskForm";
import MissedTasksModal from "../components/MissedTasksModal";
import StatsRing from "../components/StatsRing";
import OnboardingModal from "../components/OnboardingModal";
import TaskDetailModal from "../components/TaskDetailModal";

export default function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("ai_priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [missed, setMissed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  // VS Code Collapsible Tree State
  const [teamMenuOpen, setTeamMenuOpen] = useState(true);

  // Mobile drawer sidebar state — only relevant below the 820px breakpoint,
  // desktop CSS ignores this class entirely so the desktop layout is untouched.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  async function loadTasks() {
    const params = { sortBy };
    if (filter === "personal") params.type = "personal";
    if (filter.startsWith("team")) params.type = "team";

    const res = await api.get("/tasks", { params });
    setTasks(res.data.tasks || []);
  }

  async function loadStats() {
    const res = await api.get("/tasks/stats");
    setStats(res.data.stats);
  }

  useEffect(() => {
    setLoading(true);
    loadTasks().finally(() => setLoading(false));
  }, [filter, sortBy]);

  useEffect(() => {
    loadStats();
    api.get("/tasks/missed").then((res) => setMissed(res.data.missed || []));
  }, []);

  async function handleToggle(task) {
    const res = await api.patch(`/tasks/${task.id}/complete`);
    updateLocal(res.data.task);
    loadStats();
  }

  async function handlePause(task) {
    const res = await api.patch(`/tasks/${task.id}/pause`);
    updateLocal(res.data.task);
    loadStats();
  }

  async function handleResume(task) {
    const res = await api.patch(`/tasks/${task.id}/resume`);
    updateLocal(res.data.task);
    loadStats();
  }

  async function handleDelete(task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await api.delete(`/tasks/${task.id}`);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    loadStats();
  }

  function updateLocal(updated) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (selectedTask && selectedTask.id === updated.id) {
      setSelectedTask(updated);
    }
  }

  function handleCreated() {
    loadTasks();
    loadStats();
  }

  // Selecting a filter from the mobile drawer should also close the drawer,
  // so the person actually sees the list they just picked. No effect on desktop.
  function selectFilter(value) {
    setFilter(value);
    setSidebarOpen(false);
  }

  // Hierarchy Badges Counter
  const incomingTasks = tasks.filter(
    (t) => t.type === "team" && t.assignedEmail === user?.email && t.status !== "completed"
  );
  const outgoingTasks = tasks.filter(
    (t) => t.type === "team" && t.ownerEmail === user?.email && t.assignedEmail !== user?.email
  );

  const needsOnboarding = user && (!user.role || !user.department);

  const searchedTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleTasks = searchedTasks.filter((t) => {
    if (filter === "completed") return t.status === "completed";
    if (filter === "personal") return t.type === "personal";
    if (filter === "team_incoming") return t.type === "team" && t.assignedEmail === user?.email;
    if (filter === "team_outgoing") return t.type === "team" && t.ownerEmail === user?.email && t.assignedEmail !== user?.email;
    return true; // "all"
  });

  const activeTasks = visibleTasks.filter((t) => t.status !== "completed");
  const completedTasks = visibleTasks.filter((t) => t.status === "completed");

  const initials = user?.name
    ?.split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const completionPct = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const overduePct = stats && stats.total > 0 ? Math.round((stats.overdue / stats.total) * 100) : 0;

  return (
    <div className="shell">
      {needsOnboarding && (
        <OnboardingModal
          user={user}
          onComplete={(updatedUser) => {
            if (setUser) setUser(updatedUser);
            else window.location.reload();
          }}
        />
      )}

      {/* Mobile-only sticky top bar with hamburger. CSS keeps this hidden
          (display:none) on desktop, so it never shows up above 820px. */}
      <div className="mobile-topbar">
        <div className="brand">
          <span className="mark" />
          <span>Task Scheduler</span>
        </div>
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
      </div>

      {/* Dark backdrop shown only while the mobile drawer is open (CSS hides
          it entirely on desktop regardless of this being rendered). */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Modern VS Code Style Tree Sidebar.
          On desktop this renders exactly as before (in-flow, first grid column).
          On mobile the CSS turns it into a fixed slide-in drawer, toggled by
          the "open" class below. */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div>
          <div className="brand" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
            <span className="mark" style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700" }}>⚡</span>
            <span style={{ fontWeight: "700", fontSize: "18px" }}>Task Scheduler</span>
          </div>

          <button
            onClick={() => {
              setShowForm(true);
              setSidebarOpen(false);
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              backgroundColor: "#18181b",
              color: "#ffffff",
              border: "none",
              fontWeight: "600",
              cursor: "pointer",
              marginBottom: "20px",
              fontSize: "14px",
            }}
          >
            + Create Task
          </button>

          <nav>
            {/* Home / All Tasks */}
            <button
              className={`nav-item ${filter === "all" ? "active" : ""}`}
              onClick={() => selectFilter("all")}
            >
              <span>🏠</span>
              <span>Home / All Tasks</span>
            </button>

            {/* Personal Tasks */}
            <button
              className={`nav-item ${filter === "personal" ? "active" : ""}`}
              onClick={() => selectFilter("personal")}
            >
              <span>👤</span>
              <span>Personal Tasks</span>
            </button>

            {/* VS Code Collapsible Folder: Team Tasks */}
            <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
              <button
                className={`nav-item ${filter.startsWith("team") ? "active" : ""}`}
                onClick={() => setTeamMenuOpen(!teamMenuOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: filter.startsWith("team") ? "#1e1b4b" : "transparent",
                  color: filter.startsWith("team") ? "#6366f1" : "#a1a1aa",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "14px",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "10px", color: "#a1a1aa", width: "12px" }}>
                    {teamMenuOpen ? "▼" : "▶"}
                  </span>
                  <span style={{ fontSize: "15px" }}>👥</span>
                  <span style={{ whiteSpace: "nowrap" }}>Team Tasks</span>
                </div>
                {incomingTasks.length > 0 && (
                  <span
                    style={{
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "700",
                      borderRadius: "12px",
                      padding: "2px 8px",
                      lineHeight: "1",
                    }}
                  >
                    {incomingTasks.length}
                  </span>
                )}
              </button>

              {/* Sub-Tree Nested Sub-folders */}
              {teamMenuOpen && (
                <div
                  style={{
                    position: "relative",
                    paddingLeft: "20px",
                    marginLeft: "18px",
                    marginTop: "4px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    borderLeft: "1px stroke #3f3f46",
                  }}
                >
                  {/* 1. Incoming Tasks */}
                  <button
                    onClick={() => selectFilter("team_incoming")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      backgroundColor: filter === "team_incoming" ? "#27272a" : "transparent",
                      color: filter === "team_incoming" ? "#ffffff" : "#a1a1aa",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: filter === "team_incoming" ? "600" : "400",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#52525b", fontSize: "12px" }}>├─</span>
                      <span style={{ fontSize: "14px" }}>📥</span>
                      <span>From Seniors</span>
                    </div>
                    {incomingTasks.length > 0 && (
                      <span
                        style={{
                          backgroundColor: "#ef4444",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: "700",
                          borderRadius: "10px",
                          padding: "2px 6px",
                        }}
                      >
                        {incomingTasks.length}
                      </span>
                    )}
                  </button>

                  {/* 2. Outgoing Tasks */}
                  <button
                    onClick={() => selectFilter("team_outgoing")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      backgroundColor: filter === "team_outgoing" ? "#27272a" : "transparent",
                      color: filter === "team_outgoing" ? "#ffffff" : "#a1a1aa",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: filter === "team_outgoing" ? "600" : "400",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#52525b", fontSize: "12px" }}>└─</span>
                      <span style={{ fontSize: "14px" }}>📤</span>
                      <span>To Members</span>
                    </div>
                    {outgoingTasks.length > 0 && (
                      <span
                        style={{
                          backgroundColor: "#3f3f46",
                          color: "#a1a1aa",
                          fontSize: "10px",
                          fontWeight: "600",
                          borderRadius: "10px",
                          padding: "2px 6px",
                        }}
                      >
                        {outgoingTasks.length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Completed */}
            <button
              className={`nav-item ${filter === "completed" ? "active" : ""}`}
              onClick={() => selectFilter("completed")}
            >
              <span>✅</span>
              <span>Completed</span>
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div>
              <div className="name">{user?.name}</div>
              <div className="email">{user?.email}</div>
              {user?.role && (
                <div style={{ fontSize: "11px", color: "var(--accent)", marginTop: "3px" }}>
                  <strong>{user.customRole || user.role}</strong> • {user.department}
                </div>
              )}
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main" style={{ padding: "32px 40px" }}>
        {/* Dynamic Header & Search */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontSize: "30px", fontWeight: "700", color: "#09090b", marginBottom: "16px" }}>
            {getGreeting()}, start organizing! 🚀
          </h1>

          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            <input
              type="text"
              placeholder="🔍 Search tasks, descriptions, or assignees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 18px",
                borderRadius: "10px",
                border: "1px solid #e4e4e7",
                outline: "none",
                fontSize: "14px",
                backgroundColor: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            />
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="stats-row" style={{ marginBottom: "28px" }}>
            <div className="stat-card">
              <StatsRing percent={100} color="var(--info)" />
              <div>
                <div className="label">Total</div>
                <div className="value">{stats.total}</div>
              </div>
            </div>
            <div className="stat-card">
              <StatsRing percent={completionPct} color="var(--success)" />
              <div>
                <div className="label">Completed</div>
                <div className="value">{stats.completed}</div>
              </div>
            </div>
            <div className="stat-card">
              <StatsRing percent={stats.total ? Math.round((stats.pending / stats.total) * 100) : 0} color="var(--accent)" />
              <div>
                <div className="label">Incomplete</div>
                <div className="value">{stats.pending}</div>
              </div>
            </div>
            <div className="stat-card">
              <StatsRing percent={overduePct} color="var(--danger)" />
              <div>
                <div className="label">Overdue</div>
                <div className="value">{stats.overdue}</div>
              </div>
            </div>
          </div>
        )}

        {/* Sort & Section Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ fontWeight: "600", fontSize: "16px", color: "#18181b" }}>
            {filter === "all" && "🏠 Home / All Tasks"}
            {filter === "personal" && "👤 Personal Tasks"}
            {filter === "team_incoming" && "📥 Tasks From Seniors"}
            {filter === "team_outgoing" && "📤 Tasks To Members"}
            {filter === "completed" && "✅ Completed Tasks"}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <option value="ai_priority">🤖 AI Dynamic Priority Score</option>
              <option value="dueDate">📅 Due Date</option>
              <option value="createdAt">⚡ Created Date</option>
            </select>
          </div>
        </div>

        {/* Task Cards Listing */}
        {loading ? (
          <div className="empty-state">Loading workspace...</div>
        ) : (
          <>
            <div className="section-title">
              {filter === "completed" ? "Completed" : "Active"} ({activeTasks.length || completedTasks.length})
            </div>

            {(filter === "completed" ? completedTasks : activeTasks).length === 0 ? (
              <div className="empty-state">No tasks here yet. Click "+ Create Task" to get started.</div>
            ) : (
              <div className="task-list">
                {(filter === "completed" ? completedTasks : activeTasks).map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    currentUserEmail={user?.email}
                    onToggle={handleToggle}
                    onPause={handlePause}
                    onResume={handleResume}
                    onDelete={handleDelete}
                    onSelectTask={(task) => setSelectedTask(task)}
                  />
                ))}
              </div>
            )}

            {filter !== "completed" && completedTasks.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: "24px" }}>Completed ({completedTasks.length})</div>
                <div className="task-list">
                  {completedTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      currentUserEmail={user?.email}
                      onToggle={handleToggle}
                      onPause={handlePause}
                      onResume={handleResume}
                      onDelete={handleDelete}
                      onSelectTask={(task) => setSelectedTask(task)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {showForm && <TaskForm onClose={() => setShowForm(false)} onCreated={handleCreated} />}

      {missed.length > 0 && (
        <MissedTasksModal tasks={missed} onClose={() => setMissed([])} />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={(updatedTask) => {
            updateLocal(updatedTask);
            loadStats();
          }}
        />
      )}
    </div>
  );
}