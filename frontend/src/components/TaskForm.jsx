import { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function TaskForm({ onClose, onCreated }) {
  const { user } = useAuth();
  const [type, setType] = useState("personal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(30);
  const [priority, setPriority] = useState("medium");
  const [effortHours, setEffortHours] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Voice Recording state & refs
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Dynamic state for fetching team members
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (type === "team") {
      setLoadingMembers(true);
      api
        .get("/auth/team-members")
        .then((res) => {
          setTeamMembers(res.data.members || []);
          setError("");
        })
        .catch((err) => {
          console.error("Error loading team members:", err);
          setError(err.response?.data?.message || "Failed to load department members.");
        })
        .finally(() => {
          setLoadingMembers(false);
        });
    }
  }, [type]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      alert("Microphone permission is required to record voice instructions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!title.trim() && !audioBlob) {
      setError("Please enter a task title or attach a voice instruction.");
      return;
    }

    if (type === "team" && !assignedEmail.trim()) {
      setError("Please select a team member to assign the task.");
      return;
    }

    setSaving(true);

    const finalTitle = title.trim() ? title.trim() : "Voice Instruction Task";

    const formData = new FormData();
    formData.append("title", finalTitle);
    formData.append("description", description.trim());
    formData.append("type", type);
    formData.append("assignedEmail", type === "team" ? assignedEmail.trim() : "");
    formData.append("dueDate", dueDate ? new Date(dueDate).toISOString() : "");
    formData.append("reminderMinutesBefore", reminderMinutesBefore);
    formData.append("priority", priority);
    formData.append("effortHours", effortHours);

    // Fixed key name for task instruction voice note
    if (audioBlob) {
      formData.append("voice", audioBlob, "task_instruction.webm");
    }

    try {
      const res = await api.post("/tasks", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (onCreated) onCreated(res.data.task);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create the task.");
    } finally {
      setSaving(false);
    }
  }

  const assignableSubordinates = teamMembers.filter((m) => m.email !== user?.email);

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes overlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseRecord {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .task-form-overlay {
          animation: overlayFade 0.2s ease-out forwards;
        }
        .task-form-card {
          animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .form-control-input {
          transition: all 0.2s ease;
        }
        .form-control-input:focus {
          outline: none;
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
        }
        .type-toggle-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-animated {
          transition: all 0.18s ease, transform 0.1s ease;
        }
        .btn-animated:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .btn-animated:active:not(:disabled) {
          transform: translateY(0);
        }
        .pulse-recording {
          animation: pulseRecord 1.4s infinite;
        }
      `}</style>

      <div
        className="task-form-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(5px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px",
        }}
      >
        <div
          className="task-form-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            width: "100%",
            maxWidth: "460px",
            padding: "28px 30px",
            boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.2)",
            maxHeight: "92vh",
            overflowY: "auto",
          }}
        >
          <div style={{ marginBottom: "18px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#18181b", margin: 0 }}>
              New Task
            </h2>
            <p style={{ fontSize: "13px", color: "#71717a", marginTop: "4px", marginBottom: 0 }}>
              Whether it's personal work or something to assign to your team, start here.
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fca5a5",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "13px",
                fontWeight: "500",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Type Toggle Tabs */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                backgroundColor: "#f4f4f5",
                padding: "4px",
                borderRadius: "12px",
              }}
            >
              <button
                type="button"
                className="type-toggle-btn"
                onClick={() => setType("personal")}
                style={{
                  padding: "10px",
                  borderRadius: "9px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  backgroundColor: type === "personal" ? "#111827" : "transparent",
                  color: type === "personal" ? "#ffffff" : "#71717a",
                  boxShadow: type === "personal" ? "0 2px 5px rgba(0,0,0,0.15)" : "none",
                }}
              >
                🙋 Personal
              </button>

              <button
                type="button"
                className="type-toggle-btn"
                onClick={() => setType("team")}
                style={{
                  padding: "10px",
                  borderRadius: "9px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  backgroundColor: type === "team" ? "#111827" : "transparent",
                  color: type === "team" ? "#ffffff" : "#71717a",
                  boxShadow: type === "team" ? "0 2px 5px rgba(0,0,0,0.15)" : "none",
                }}
              >
                👥 Team
              </button>
            </div>

            {/* Title Input */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                Title
              </label>
              <input
                className="form-control-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Submit the monthly report"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #e4e4e7",
                  fontSize: "14px",
                  backgroundColor: "#fafafa",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Description Textarea */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                Description (optional)
              </label>
              <textarea
                rows="3"
                className="form-control-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #e4e4e7",
                  fontSize: "14px",
                  backgroundColor: "#fafafa",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Voice Instruction Module */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                Voice Instruction (optional)
              </label>
              <div>
                {!recording && !audioBlob && (
                  <button
                    type="button"
                    className="btn-animated"
                    onClick={startRecording}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 16px",
                      borderRadius: "10px",
                      backgroundColor: "#ef4444",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(239, 68, 68, 0.25)",
                    }}
                  >
                    🎙️ Record Voice Instruction
                  </button>
                )}

                {recording && (
                  <button
                    type="button"
                    className="pulse-recording"
                    onClick={stopRecording}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 16px",
                      borderRadius: "10px",
                      backgroundColor: "#10b981",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    ⏹️ Stop Recording
                  </button>
                )}

                {audioBlob && !recording && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {audioUrl && <audio controls src={audioUrl} style={{ height: "34px", flex: 1 }} />}
                    <button
                      type="button"
                      onClick={clearAudio}
                      style={{
                        border: "none",
                        backgroundColor: "#fee2e2",
                        color: "#ef4444",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Team Dropdown */}
            {type === "team" && (
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                  Assign to Team Member
                </label>
                <select
                  className="form-control-input"
                  value={assignedEmail}
                  onChange={(e) => setAssignedEmail(e.target.value)}
                  disabled={loadingMembers}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e4e4e7",
                    fontSize: "14px",
                    backgroundColor: "#fafafa",
                    color: "#18181b",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">
                    {loadingMembers
                      ? "Loading assignable team members..."
                      : "-- Select Subordinate --"}
                  </option>
                  {assignableSubordinates.map((member) => (
                    <option key={member.id} value={member.email}>
                      {member.name} ({member.email}) • {member.customRole || member.role}
                    </option>
                  ))}
                </select>
                {!loadingMembers && assignableSubordinates.length === 0 && (
                  <small style={{ color: "#ef4444", marginTop: "4px", display: "block", fontSize: "11px" }}>
                    No assignable team members found in your hierarchy level.
                  </small>
                )}
              </div>
            )}

            {/* Due Date & Base Priority */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                  Due date & time
                </label>
                <input
                  type="datetime-local"
                  className="form-control-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e4e4e7",
                    fontSize: "13px",
                    backgroundColor: "#fafafa",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                  Base Priority
                </label>
                <select
                  className="form-control-input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e4e4e7",
                    fontSize: "13px",
                    backgroundColor: "#fafafa",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Estimated Effort & Reminder */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                  Estimated Effort (Hours)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className="form-control-input"
                  value={effortHours}
                  onChange={(e) => setEffortHours(e.target.value)}
                  placeholder="1"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e4e4e7",
                    fontSize: "13px",
                    backgroundColor: "#fafafa",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#3f3f46", marginBottom: "6px" }}>
                  Reminder (Minutes Before)
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-control-input"
                  value={reminderMinutesBefore}
                  onChange={(e) => setReminderMinutesBefore(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: "1px solid #e4e4e7",
                    fontSize: "13px",
                    backgroundColor: "#fafafa",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                className="btn-animated"
                onClick={onClose}
                style={{
                  padding: "11px",
                  borderRadius: "10px",
                  border: "1px solid #e4e4e7",
                  backgroundColor: "#ffffff",
                  color: "#52525b",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn-animated"
                disabled={saving || (type === "team" && assignableSubordinates.length === 0)}
                style={{
                  padding: "11px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#f59e0b",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
                  opacity: saving || (type === "team" && assignableSubordinates.length === 0) ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
} 