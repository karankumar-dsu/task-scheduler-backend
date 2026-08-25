import React, { useState } from "react";

export default function Sidebar({
  currentFilter,
  onSelectFilter,
  unreadCount = 0,
  incomingCount = 0,
  outgoingCount = 0,
}) {
  const [teamTasksOpen, setTeamTasksOpen] = useState(true);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.menuGroup}>
        {/* All Tasks */}
        <div
          style={{
            ...styles.navItem,
            ...(currentFilter === "all" ? styles.activeNavItem : {}),
          }}
          onClick={() => onSelectFilter("all")}
        >
          <span>🏠</span>
          <span>Home / All Tasks</span>
        </div>

        {/* Personal Tasks */}
        <div
          style={{
            ...styles.navItem,
            ...(currentFilter === "personal" ? styles.activeNavItem : {}),
          }}
          onClick={() => onSelectFilter("personal")}
        >
          <span>👤</span>
          <span>Personal Tasks</span>
        </div>

        {/* VS Code Style Collapsible Team Tasks Folder */}
        <div style={styles.folderContainer}>
          <div
            style={{
              ...styles.navItem,
              ...(currentFilter.startsWith("team") ? styles.activeNavItem : {}),
              justifyContent: "space-between",
            }}
            onClick={() => setTeamTasksOpen(!teamTasksOpen)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px" }}>{teamTasksOpen ? "▼" : "▶"}</span>
              <span>👥 Team Tasks</span>
            </div>
            {unreadCount > 0 && (
              <span style={styles.badge}>{unreadCount}</span>
            )}
          </div>

          {/* Sub-Tree Nested Items */}
          {teamTasksOpen && (
            <div style={styles.treeSubMenu}>
              <div
                style={{
                  ...styles.treeItem,
                  ...(currentFilter === "team_incoming" ? styles.activeTreeItem : {}),
                }}
                onClick={() => onSelectFilter("team_incoming")}
              >
                <span style={styles.treeLine}>├──</span>
                <span>📥 From Seniors / Heads</span>
                {incomingCount > 0 && (
                  <span style={styles.smallBadge}>{incomingCount}</span>
                )}
              </div>

              <div
                style={{
                  ...styles.treeItem,
                  ...(currentFilter === "team_outgoing" ? styles.activeTreeItem : {}),
                }}
                onClick={() => onSelectFilter("team_outgoing")}
              >
                <span style={styles.treeLine}>└──</span>
                <span>📤 To Team Members</span>
                {outgoingCount > 0 && (
                  <span style={styles.grayBadge}>{outgoingCount}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Completed */}
        <div
          style={{
            ...styles.navItem,
            ...(currentFilter === "completed" ? styles.activeNavItem : {}),
          }}
          onClick={() => onSelectFilter("completed")}
        >
          <span>✅</span>
          <span>Completed</span>
        </div>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "250px",
    backgroundColor: "#1e1e2e",
    color: "#cdd6f4",
    height: "100vh",
    padding: "16px 12px",
    userSelect: "none",
    boxSizing: "border-box",
  },
  menuGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    color: "#a6adc8",
  },
  activeNavItem: {
    backgroundColor: "#313244",
    color: "#ffffff",
    fontWeight: "bold",
  },
  folderContainer: {
    display: "flex",
    flexDirection: "column",
  },
  treeSubMenu: {
    display: "flex",
    flexDirection: "column",
    paddingLeft: "12px",
    marginTop: "2px",
    borderLeft: "1px dashed #45475a",
    marginLeft: "16px",
  },
  treeItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    fontSize: "13px",
    color: "#bac2de",
    cursor: "pointer",
    borderRadius: "4px",
  },
  activeTreeItem: {
    backgroundColor: "#45475a",
    color: "#89b4fa",
    fontWeight: "600",
  },
  treeLine: {
    color: "#585b70",
  },
  badge: {
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "bold",
    borderRadius: "10px",
    padding: "2px 6px",
  },
  smallBadge: {
    backgroundColor: "#ef4444",
    color: "#fff",
    fontSize: "10px",
    fontWeight: "bold",
    borderRadius: "8px",
    padding: "1px 5px",
    marginLeft: "auto",
  },
  grayBadge: {
    backgroundColor: "#45475a",
    color: "#cdd6f4",
    fontSize: "10px",
    borderRadius: "8px",
    padding: "1px 5px",
    marginLeft: "auto",
  },
};