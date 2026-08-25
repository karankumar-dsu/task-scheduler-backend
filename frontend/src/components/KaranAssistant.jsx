const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/User");

const router = express.Router();
router.use(auth);

// Same rank helper used in taskRoutes.js — kept local to avoid coupling the two files.
function getRoleRank(user) {
  if (!user) return 0;
  const baseRanks = {
    Admin: 5,
    "Division Head": 4,
    "Wing Head": 3,
    "Team Lead": 2,
    "Team Member": 1,
    Intern: 0,
  };
  if (baseRanks[user.role] !== undefined) return baseRanks[user.role];
  if (user.role === "other" && user.relation) {
    const refRank = baseRanks[user.relation.referenceRole] ?? 2;
    return user.relation.position === "above" ? refRank + 0.5 : refRank - 0.5;
  }
  return 1;
}

function getAssignableTeamMembers(currentUser) {
  if (!currentUser || !currentUser.department) return [];
  const currentUserRank = getRoleRank(currentUser);
  const members = User.findByDepartment(currentUser.department);
  return members.filter((m) => {
    if (m.id === currentUser.id) return false;
    if (currentUser.role === "Admin") return true;
    if (m.assignableBy && Array.isArray(m.assignableBy)) {
      if (m.assignableBy.includes(currentUser.role) || m.assignableBy.includes("ALL")) return true;
    }
    return currentUserRank > getRoleRank(m);
  });
}

// Fields the assistant is trying to fill in, mirroring TaskForm.jsx exactly.
const REQUIRED_ALWAYS = ["title", "type"];

function buildSystemPrompt(teamMembers, todayIso) {
  const membersList = teamMembers.length
    ? teamMembers.map((m) => `- ${m.name} <${m.email}> (${m.customRole || m.role})`).join("\n")
    : "(no assignable team members found for this user)";

  return `You are a voice task-creation assistant embedded in a to-do list web app. You speak Hinglish (mix of Hindi and English) naturally and casually, like a helpful assistant would to an Indian user. You are professional but warm — never robotic-sounding filler.

Your job: through natural back-and-forth conversation, collect enough information to create ONE task, then hand back structured JSON.

The task object you are filling in has these fields:
- title (string, required) — short task name
- description (string, optional)
- type ("personal" | "team", required)
- assignedEmail (string, required ONLY if type is "team") — MUST be the exact email of one of the team members listed below. Never invent an email. If the person's spoken name is ambiguous or matches nobody in the list, ask them to clarify or pick from the list by name.
- dueDate (ISO 8601 datetime string, optional but should be asked for) — combine any date + time the user gives you into one ISO datetime. Today's date is ${todayIso}.
- priority ("low" | "medium" | "high", default "medium")
- effortHours (number, default 1)
- reminderMinutesBefore (number, default 30)

Team members this user is allowed to assign tasks to:
${membersList}

Rules:
- The user may phrase things in totally different ways each time ("task banao", "ek kaam add karna hai", "naya to-do daalo", etc.) — never rely on fixed keywords, understand intent from meaning.
- Only ask about ONE missing thing at a time, in a short natural Hinglish sentence.
- If type is "personal", never ask about assignedEmail.
- If type is "team" and the user hasn't named a valid member yet, ask for it before asking anything else about the task.
- If the user's message clearly supplies multiple fields at once (e.g. "team task banao, priya ko high priority ka bug fix task do kal tak"), extract everything you can in one go rather than asking one by one.
- Once title, type (and assignedEmail if team) are known, you may use sensible defaults for anything the user skips or says "skip"/"chhodo"/"koi zarurat nahi" for (priority=medium, effortHours=1, reminderMinutesBefore=30, description="").
- Never fabricate a dueDate — if the user never gives one after being asked once, leave it null and move on.
- When you have title, type, and (if team) a valid assignedEmail, set "done": true and stop asking further questions unless the user is still actively giving more detail.
- If the user says something unrelated to task creation, gently steer back in your "reply".

You MUST respond with ONLY a single valid JSON object, no markdown fences, no extra text, in exactly this shape:
{
  "reply": "short Hinglish sentence to speak back to the user",
  "done": boolean,
  "fields": {
    "title": string | null,
    "description": string | null,
    "type": "personal" | "team" | null,
    "assignedEmail": string | null,
    "dueDate": string | null,
    "priority": "low" | "medium" | "high" | null,
    "effortHours": number | null,
    "reminderMinutesBefore": number | null
  }
}`;
}

// POST /api/assistant/interpret
// Body: { message: string, history: [{role: "user"|"assistant", content: string}], fields: {...current known fields...} }
router.post("/interpret", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ message: "ANTHROPIC_API_KEY is not configured on the server." });
    }

    const { message, history = [], fields = {} } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "message is required." });
    }

    const currentUser = User.findById(req.user.id);
    const teamMembers = getAssignableTeamMembers(currentUser);
    const todayIso = new Date().toISOString();

    const systemPrompt = buildSystemPrompt(teamMembers, todayIso);

    // Give the model the running state of known fields so it doesn't re-ask
    // things it already has, and doesn't forget things across turns.
    const stateNote = `Current known fields (from earlier in this conversation): ${JSON.stringify(fields)}`;

    const messages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: `${stateNote}\n\nUser just said: "${message}"` },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(502).json({ message: "AI assistant is temporarily unavailable." });
    }

    const data = await response.json();
    const rawText = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    let parsed;
    try {
      // Model is instructed to return pure JSON, but strip code fences defensively.
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response as JSON:", rawText);
      return res.status(502).json({
        message: "AI response could not be understood.",
        reply: "Mujhe thoda samajhne mein dikkat hui, ek baar phir se boliye.",
        done: false,
        fields,
      });
    }

    // Merge: keep any previously-known field if the model returned null for it this turn.
    const mergedFields = { ...fields };
    for (const [key, value] of Object.entries(parsed.fields || {})) {
      if (value !== null && value !== undefined && value !== "") {
        mergedFields[key] = value;
      }
    }

    // Validate assignedEmail against the real list before trusting it.
    if (mergedFields.type === "team" && mergedFields.assignedEmail) {
      const validEmails = teamMembers.map((m) => m.email.toLowerCase());
      if (!validEmails.includes(String(mergedFields.assignedEmail).toLowerCase())) {
        mergedFields.assignedEmail = null; // don't let a hallucinated email through
      }
    }

    const readyToSave =
      !!mergedFields.title &&
      !!mergedFields.type &&
      (mergedFields.type !== "team" || !!mergedFields.assignedEmail);

    res.json({
      reply: parsed.reply,
      done: !!parsed.done && readyToSave,
      fields: mergedFields,
      teamMembers: teamMembers.map((m) => ({ name: m.name, email: m.email, role: m.customRole || m.role })),
    });
  } catch (err) {
    console.error("Assistant interpret error:", err);
    res.status(500).json({ message: "Something went wrong understanding that." });
  }
});

module.exports = router;