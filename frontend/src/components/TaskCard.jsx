import React, { useState } from "react";

function formatDue(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskCard({
  task,
  currentUserEmail,
  onToggle,
  onPause,
  onResume,
  onDelete,
  onEdit, // <-- New prop for handling task updates
  onSelectTask,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title || "");
  const [editDescription, setEditDescription] = useState(task.description || "");

  const isOwner = task.ownerEmail?.toLowerCase() === currentUserEmail?.toLowerCase();
  const isCompleted = task.status === "completed";
  const isPaused = task.status === "paused";
  const isOverdue =
    task.status === "pending" && task.dueDate && new Date(task.dueDate) < new Date();

  const commentsCount = task.comments ? task.comments.length : 0;

  // AI Priority Score Styling Helper
  const getAIScoreBadge = (score = 0) => {
    let bg = "#f4f4f5";
    let color = "#71717a";
    let border = "#e4e4e7";
    let icon = "🟢";

    if (score >= 75) {
      bg = "#fef2f2";
      color = "#ef4444";
      border = "#fca5a5";
      icon = "🔥";
    } else if (score >= 45) {
      bg = "#fffbe8";
      color = "#d97706";
      border = "#fde68a";
      icon = "⚡";
    }

    return (
      <span
        title="AI Dynamic Priority Score"
        style={{
          backgroundColor: bg,
          color: color,
          border: `1px solid ${border}`,
          fontSize: "11px",
          fontWeight: "700",
          borderRadius: "10px",
          padding: "2px 8px",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {icon} AI {score}/100
      </span>
    );
  };

  const handleSaveEdit = (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit({ ...task, title: editTitle, description: editDescription });
    }
    setIsEditing(false);
  };

  return (
    <div
      onClick={() => !isEditing && onSelectTask && onSelectTask(task)}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        border: "1px solid #e4e4e7",
        padding: "16px 20px",
        marginBottom: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.2s ease",
        opacity: isCompleted ? 0.65 : 1,
        cursor: "pointer",
      }}
    >
      {/* Checkbox & Task Main Info / Inline Edit View */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1 }}>
        {!isEditing && (
          <input
            type="checkbox"
            checked={isCompleted}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(task);
            }}
            title={isCompleted ? "Mark incomplete" : "Mark complete"}
            style={{
              width: "18px",
              height: "18px",
              marginTop: "3px",
              cursor: "pointer",
              accentColor: "#6366f1",
            }}
          />
        )}

        {isEditing ? (
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, marginRight: "10px" }}
          >
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Task title..."
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                fontWeight: "600",
                outline: "none",
              }}
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Task description..."
              rows={2}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                outline: "none",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: "4px 12px",
                  backgroundColor: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(false);
                }}
                style={{
                  padding: "4px 12px",
                  backgroundColor: "#e4e4e7",
                  color: "#3f3f46",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "15px",
                  fontWeight: "600",
                  color: isCompleted ? "#71717a" : "#18181b",
                  textDecoration: isCompleted ? "line-through" : "none",
                }}
              >
                {task.title}
              </span>

              {/* Dynamic AI Priority Badge */}
              {getAIScoreBadge(task.priorityScore || 0)}

              {/* Type & Status Badges */}
              {task.type === "team" && (
                <span style={{ backgroundColor: "#e0e7ff", color: "#4338ca", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px" }}>
                  Team
                </span>
              )}
              {task.priority && (
                <span style={{ backgroundColor: "#f4f4f5", color: "#52525b", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px", textTransform: "capitalize" }}>
                  {task.priority}
                </span>
              )}
              {isPaused && (
                <span style={{ backgroundColor: "#fef3c7", color: "#b45309", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px" }}>
                  Paused
                </span>
              )}
              {isOverdue && (
                <span style={{ backgroundColor: "#fee2e2", color: "#b91c1c", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px" }}>
                  Overdue
                </span>
              )}

              {/* Voice Notes */}
              {task.taskVoiceUrl && (
                <span title="Voice instruction attached" style={{ backgroundColor: "#f3e8ff", color: "#6b21a8", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px" }}>
                  🎙️ Voice Instruction
                </span>
              )}
              {task.voiceMailUrl && (
                <span title="Signed-off voice note attached" style={{ backgroundColor: "#f3e8ff", color: "#6b21a8", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px" }}>
                  🎙️ Sign-off Voice
                </span>
              )}
            </div>

            {task.description && (
              <div style={{ fontSize: "13px", color: "#71717a", lineHeight: "1.4" }}>
                {task.description}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", fontSize: "12px", color: "#71717a", marginTop: "2px" }}>
              <span>⏱️ {task.effortHours || 1} hrs</span>
              {task.dueDate && <span>📅 {formatDue(task.dueDate)}</span>}
              {task.type === "team" && (
                <span>
                  👤 {isOwner ? `Assigned to ${task.assignedEmail}` : `From ${task.ownerEmail}`}
                </span>
              )}
              {commentsCount > 0 && (
                <span>💬 {commentsCount} {commentsCount === 1 ? "Comment" : "Comments"}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons with e.stopPropagation */}
      {!isEditing && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "12px" }}>
          {/* Complete Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(task);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: isCompleted ? "#f3f4f6" : "#ecfdf5",
              color: isCompleted ? "#4b5563" : "#059669",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            {isCompleted ? "↩ Undo" : "✓ Complete"}
          </button>

          {/* Edit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              color: "#4f46e5",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            ✏️ Edit
          </button>

          {!isCompleted && (
            isPaused ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResume(task);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  color: "#16a34a",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ▶ Resume
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPause(task);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  color: "#d97706",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ⏸ Pause
              </button>
            )
          )}

          {isOwner && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#fef2f2",
                color: "#ef4444",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}