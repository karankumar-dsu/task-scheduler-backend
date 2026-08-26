import React, { useState, useRef, useEffect } from "react";
import api from "../api/axios";

/**
 * Voice-driven task creation assistant.
 *
 * Unlike a keyword-matching state machine, every user turn is sent to
 * POST /api/assistant/interpret, which uses an LLM to understand natural,
 * varied phrasing ("task banao", "ek kaam add karna hai", "naya to-do
 * daalo", or a single sentence that supplies several fields at once).
 * The backend returns the next thing to say, the merged/validated task
 * fields collected so far, and whether enough info exists to save.
 */
export default function KaranAssistant({ onTaskCreated }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Standby");
  const [phase, setPhase] = useState("IDLE"); // IDLE | CONVERSING | SAVING

  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const isListeningRef = useRef(false);
  const phaseRef = useRef("IDLE");

  // Running conversation state sent to the backend each turn.
  const historyRef = useRef([]); // [{role:"user"|"assistant", content:string}]
  const fieldsRef = useRef({}); // merged/validated task fields returned by the backend

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const setPhaseBoth = (val) => {
    phaseRef.current = val;
    setPhase(val);
  };

  // ---- Text-to-speech, callback fires only once speech actually finishes ----
  const speak = (text, callback) => {
    if (!("speechSynthesis" in window)) {
      if (callback) callback();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.lang = "hi-IN";

    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(
      (v) => v.lang.includes("hi-IN") || v.name.includes("Swara") || v.name.includes("Hindi")
    );
    if (indianVoice) utterance.voice = indianVoice;

    utterance.onend = () => callback && callback();
    utterance.onerror = () => callback && callback(); // don't get stuck if TTS itself fails

    window.speechSynthesis.speak(utterance);
  };

  // ---- Create the recognition instance exactly once ----
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    // en-IN transcribes Hinglish in Latin script most reliably. The LLM on
    // the backend can handle either script anyway, so this is just for
    // best-effort accuracy, not a hard requirement like the old keyword version.
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
    };

    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript.trim();
      setTranscript(spoken);
      handleUserTurn(spoken);
    };

    recognition.onerror = (event) => {
      recognitionActiveRef.current = false;
      if (event.error === "no-speech") {
        setStatus("Kuch suna nahi, phir se boliye...");
        safeStart();
        return;
      }
      console.error("Speech error", event.error);
      setStatus("Error - dobara try karein");
      setIsListening(false);
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;
      if (isListeningRef.current && phaseRef.current === "CONVERSING") {
        safeStart(); // recovers from silent timeouts some browsers produce
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      } catch (e) {
        /* no-op */
      }
    };
  }, []);

  const safeStart = () => {
    if (!recognitionRef.current) return;
    if (recognitionActiveRef.current) return; // avoid InvalidStateError from double start()
    try {
      setStatus("Listening...");
      setIsListening(true);
      recognitionRef.current.start();
    } catch (err) {
      console.error("start() failed", err);
      setStatus("Mic start nahi ho paaya, dobara try karein");
      setIsListening(false);
    }
  };

  const resetConversation = () => {
    historyRef.current = [];
    fieldsRef.current = {};
  };

  const toggleAssistant = () => {
    if (isListening || phaseRef.current !== "IDLE") {
      try {
        recognitionRef.current?.abort();
      } catch (e) {
        /* no-op */
      }
      setIsListening(false);
      setStatus("Standby");
      setPhaseBoth("IDLE");
      resetConversation();
      return;
    }

    setTranscript("");
    resetConversation();
    setPhaseBoth("CONVERSING");
    setStatus("Bol raha hoon...");
    speak("Namaste! Boliye, kya task banana hai?", () => safeStart());
  };

  // ---- Every user utterance goes through the AI interpreter, no keyword matching ----
  const handleUserTurn = async (spoken) => {
    if (!spoken) {
      safeStart();
      return;
    }

    // A hard client-side escape hatch, so cancelling never depends on the model.
    const lower = spoken.toLowerCase();
    const cancelWords = ["cancel", "कैंसिल", "rok do", "रोक दो", "band karo", "बंद करो"];
    if (cancelWords.some((w) => lower.includes(w))) {
      setPhaseBoth("IDLE");
      setStatus("Standby");
      setIsListening(false);
      resetConversation();
      speak("Theek hai, cancel kar diya.");
      return;
    }

    setStatus("Samajh raha hoon...");

    try {
      const res = await api.post("/assistant/interpret", {
        message: spoken,
        history: historyRef.current,
        fields: fieldsRef.current,
      });

      const { reply, done, fields } = res.data;

      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: spoken },
        { role: "assistant", content: reply },
      ];
      fieldsRef.current = fields || fieldsRef.current;

      if (done) {
        await saveTask(fieldsRef.current, reply);
      } else {
        speak(reply, () => safeStart());
      }
    } catch (err) {
      console.error("Assistant interpret error:", err);
      const message = err.response?.data?.message || "Kuch samajhne mein dikkat hui.";
      setStatus("Error");
      speak(`${message} Phir se boliye.`, () => safeStart());
    }
  };

  const saveTask = async (fields, spokenConfirmation) => {
    setPhaseBoth("SAVING");
    setStatus("Saving...");
    try {
      const formData = new FormData();
      formData.append("title", fields.title || "");
      formData.append("description", fields.description || "");
      formData.append("type", fields.type || "personal");
      formData.append("assignedEmail", fields.type === "team" ? fields.assignedEmail || "" : "");
      formData.append("dueDate", fields.dueDate || "");
      formData.append("reminderMinutesBefore", fields.reminderMinutesBefore ?? 30);
      formData.append("priority", fields.priority || "medium");
      formData.append("effortHours", fields.effortHours ?? 1);

      const res = await api.post("/tasks", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setStatus("Done!");
      setIsListening(false);
      speak(`Badhai ho! ${fields.title} naam se task ban gaya hai.`);

      if (onTaskCreated) onTaskCreated(res.data.task);
      resetConversation();
      setPhaseBoth("IDLE");
    } catch (err) {
      console.error("Task save error:", err);
      const message = err.response?.data?.message || "Task save karne mein pareshani aa gayi hai.";
      setStatus("Error");
      setIsListening(false);
      speak(message);
      setPhaseBoth("IDLE");
    }
  };

  return (
    <div className="karan-assistant-widget" style={styles.container}>
      <button
        onClick={toggleAssistant}
        style={{
          ...styles.btn,
          backgroundColor: isListening ? "#10b981" : "#1e1b4b",
          boxShadow: isListening ? "0 0 20px rgba(16, 185, 129, 0.6)" : "0 4px 14px rgba(0,0,0,0.3)",
        }}
        title="Toggle AI Assistant"
      >
        {isListening ? "🎙️ Sun raha hoon..." : "🤖 Start Assistant"}
      </button>

      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#10b981", textTransform: "uppercase" }}>
            Voice Agent ({phase})
          </span>
          <span style={{ fontSize: "11px", color: "#64748b" }}>{status}</span>
        </div>
        {transcript && (
          <p style={{ fontSize: "12px", color: "#334155", margin: "4px 0 0", fontStyle: "italic" }}>
            "{transcript}"
          </p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
    fontFamily: "inherit",
  },
  btn: {
    color: "#ffffff",
    border: "none",
    padding: "12px 20px",
    borderRadius: "30px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  card: {
    backgroundColor: "#ffffff",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    width: "260px",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
  },
};