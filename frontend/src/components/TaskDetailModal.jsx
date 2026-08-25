import React, { useState, useRef } from "react";
import api from "../api/axios";

export default function TaskDetailModal({ task, onClose, onTaskUpdated }) {
  const [activeTab, setActiveTab] = useState("discussion");
  const [commentText, setCommentText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [remarks, setRemarks] = useState("");

  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  if (!task) return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      alert("Microphone permission required for voice recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() && !imageFile && !audioBlob) return;

    setLoading(true);
    const formData = new FormData();

    // Fallback text setup taaki empty text error na aaye jab image/audio bhej rahe ho
    let textToSend = commentText.trim();
    if (!textToSend) {
      if (imageFile && audioBlob) textToSend = "[Image & Voice Note]";
      else if (imageFile) textToSend = "[Image Attachment]";
      else if (audioBlob) textToSend = "[Voice Note]";
    }

    formData.append("message", textToSend);
    formData.append("comment", textToSend);
    formData.append("text", textToSend);

    if (imageFile) formData.append("image", imageFile);
    if (audioBlob) formData.append("voiceNote", audioBlob, "query_voice.webm");

    try {
      const res = await api.post(`/tasks/${task.id}/comments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCommentText("");
      setImageFile(null);
      setAudioBlob(null);
      if (onTaskUpdated) onTaskUpdated(res.data.task);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add comment.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOff = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("remarks", remarks);
    if (audioBlob) {
      formData.append("voiceMail", audioBlob, "signoff_voicemail.webm");
    }

    try {
      const res = await api.post(`/tasks/${task.id}/sign-off`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setLoading(false);
      alert("Task signed off successfully!");
      if (onTaskUpdated) onTaskUpdated(res.data.task);
      onClose();
    } catch (err) {
      setLoading(false);
      alert(err.response?.data?.message || "Sign-off failed.");
    }
  };

  const getMediaUrl = (url) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `${api.defaults.baseURL.replace("/api", "")}${url}`;
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>{task.title}</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {task.description && <p style={styles.desc}>{task.description}</p>}

        {/* Creator Voice Instruction */}
        {task.taskVoiceUrl && (
          <div style={styles.voiceInstructionBox}>
            <p style={styles.voiceTitle}>🎙️ Initial Voice Instruction:</p>
            <audio controls src={getMediaUrl(task.taskVoiceUrl)} style={{ width: "100%", height: "36px" }} />
          </div>
        )}

        {/* Signed-off Voice Note */}
        {task.voiceMailUrl && (
          <div style={styles.signedOffBox}>
            <p style={styles.signedOffTitle}>✅ Signed-off Voice Note:</p>
            <audio controls src={getMediaUrl(task.voiceMailUrl)} style={{ width: "100%", height: "36px" }} />
            {task.signRemarks && (
              <p style={{ marginTop: "6px", fontSize: "13px", color: "#475569" }}>
                <strong>Remarks:</strong> {task.signRemarks}
              </p>
            )}
          </div>
        )}

        {/* Pill Style Tabs */}
        <div style={styles.tabContainer}>
          <button
            type="button"
            style={activeTab === "discussion" ? styles.activeTab : styles.tab}
            onClick={() => { setActiveTab("discussion"); setAudioBlob(null); setRecording(false); }}
          >
            💬 Discussion ({task.comments?.length || 0})
          </button>
          {task.status !== "completed" && (
            <button
              type="button"
              style={activeTab === "signoff" ? styles.activeTab : styles.tab}
              onClick={() => { setActiveTab("signoff"); setAudioBlob(null); setRecording(false); }}
            >
              ✅ Sign-Off
            </button>
          )}
        </div>

        {/* TAB 1: Chat Discussion */}
        {activeTab === "discussion" && (
          <div>
            <div style={styles.commentsList}>
              {(task.comments || []).map((c, i) => (
                <div key={i} style={styles.commentItem}>
                  <div style={styles.senderHeader}>{c.senderName || c.senderEmail}</div>
                  {c.message && <p style={{ margin: "4px 0", fontSize: "14px", color: "#334155" }}>{c.message}</p>}
                  {c.imageUrl && (
                    <img src={getMediaUrl(c.imageUrl)} alt="attachment" style={styles.chatImg} />
                  )}
                  {c.voiceUrl && (
                    <audio controls src={getMediaUrl(c.voiceUrl)} style={{ width: "100%", height: "32px", marginTop: "4px" }} />
                  )}
                </div>
              ))}
              {(!task.comments || task.comments.length === 0) && (
                <div style={styles.emptyState}>
                  No queries or discussions yet.
                </div>
              )}
            </div>

            {/* Stylish Input Bar */}
            <form onSubmit={handleAddComment} style={{ marginTop: "14px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Write a comment or query..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  style={styles.input}
                />
                
                <button
                  type="button"
                  title="Attach Image"
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.iconBtn}
                >
                  🖼️
                </button>

                {!recording ? (
                  <button
                    type="button"
                    title="Record Voice"
                    onClick={startRecording}
                    style={styles.iconBtn}
                  >
                    🎙️
                  </button>
                ) : (
                  <button
                    type="button"
                    title="Stop Recording"
                    onClick={stopRecording}
                    style={styles.recActiveBtn}
                  >
                    ⏹️
                  </button>
                )}

                <button type="submit" disabled={loading} style={styles.btnPrimary}>
                  {loading ? "..." : "Send"}
                </button>
              </div>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => setImageFile(e.target.files[0] || null)}
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "6px", fontSize: "12px" }}>
                {imageFile && <span style={{ color: "#2563eb", fontWeight: "600" }}>📷 {imageFile.name}</span>}
                {audioBlob && <span style={{ color: "#10b981", fontWeight: "600" }}>✓ Voice Message Attached</span>}
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Sign-Off */}
        {activeTab === "signoff" && task.status !== "completed" && (
          <div style={{ marginTop: "10px" }}>
            <textarea
              placeholder="Enter completion remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={styles.textarea}
            />

            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
              {!recording ? (
                <button type="button" onClick={startRecording} style={styles.btnRecord}>
                  🎙️ Record Voice Note
                </button>
              ) : (
                <button type="button" onClick={stopRecording} style={styles.btnStop}>
                  ⏹️ Stop Recording
                </button>
              )}
              {audioBlob && <span style={{ color: "#10b981", fontSize: "13px", fontWeight: "600" }}>✓ Voice Mail Ready</span>}
            </div>

            <button onClick={handleSignOff} disabled={loading} style={styles.btnSuccess}>
              {loading ? "Submitting..." : "Complete & Sign Off"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.55)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#ffffff",
    padding: "24px",
    borderRadius: "18px",
    width: "90%",
    maxWidth: "500px",
    maxHeight: "88vh",
    overflowY: "auto",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    border: "1px solid #f1f5f9",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  closeBtn: {
    background: "#f1f5f9",
    border: "none",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    fontSize: "14px",
    color: "#64748b",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
  desc: {
    color: "#64748b",
    marginBottom: "16px",
    fontSize: "14px",
    lineHeight: "1.5",
  },
  voiceInstructionBox: {
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    padding: "12px",
    borderRadius: "12px",
    marginBottom: "16px",
  },
  voiceTitle: {
    margin: "0 0 6px 0",
    fontSize: "12px",
    fontWeight: "700",
    color: "#0284c7",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  signedOffBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    padding: "12px",
    borderRadius: "12px",
    marginBottom: "16px",
  },
  signedOffTitle: {
    margin: "0 0 6px 0",
    fontSize: "12px",
    fontWeight: "700",
    color: "#16a34a",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  tabContainer: {
    display: "flex",
    background: "#f8fafc",
    padding: "4px",
    borderRadius: "12px",
    marginBottom: "16px",
    border: "1px solid #e2e8f0",
  },
  tab: {
    flex: 1,
    padding: "9px 0",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#64748b",
    fontWeight: "600",
    fontSize: "13px",
    borderRadius: "8px",
    transition: "all 0.2s ease",
  },
  activeTab: {
    flex: 1,
    padding: "9px 0",
    border: "none",
    background: "#ffffff",
    cursor: "pointer",
    color: "#2563eb",
    fontWeight: "700",
    fontSize: "13px",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
  },
  commentsList: {
    maxHeight: "220px",
    overflowY: "auto",
    background: "#f8fafc",
    border: "1px solid #f1f5f9",
    padding: "12px",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  commentItem: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    padding: "10px 14px",
    borderRadius: "10px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  senderHeader: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#64748b",
    marginBottom: "2px",
  },
  chatImg: {
    maxWidth: "100%",
    maxHeight: "150px",
    borderRadius: "8px",
    marginTop: "6px",
    display: "block",
  },
  emptyState: {
    color: "#94a3b8",
    fontSize: "14px",
    textAlign: "center",
    padding: "24px 0",
    fontWeight: "500",
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s ease",
  },
  iconBtn: {
    padding: "9px 12px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  recActiveBtn: {
    padding: "9px 12px",
    border: "none",
    background: "#ef4444",
    color: "#ffffff",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    marginBottom: "12px",
    height: "80px",
    fontSize: "14px",
    outline: "none",
    resize: "none",
  },
  btnPrimary: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    padding: "10px 18px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
  },
  btnSuccess: {
    width: "100%",
    background: "#16a34a",
    color: "#ffffff",
    border: "none",
    padding: "12px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
  },
  btnRecord: {
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  btnStop: {
    background: "#16a34a",
    color: "#ffffff",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
};