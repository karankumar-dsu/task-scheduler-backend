const cron = require("node-cron");
const Task = require("../models/Task");
const User = require("../models/User");
const { sendEmail, reminderEmail } = require("./sendEmail");
const { emitToEmail } = require("./socket");

function nameFromEmail(email) {
  const user = User.findByEmail(email);
  return user ? user.name : email;
}

// Runs every minute: finds tasks whose due date is within the reminder
// window and haven't been notified yet -> emails assignee + owner ("sir")
// and pushes an in-app popup event over socket.io.
function startReminderJob() {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const tasks = Task.all();

    for (const task of tasks) {
      if (task.status !== "pending") continue; // skip completed/paused
      if (!task.dueDate) continue;
      if (task.reminderSentAt) continue;

      const due = new Date(task.dueDate);
      const leadMs = (task.reminderMinutesBefore || 30) * 60 * 1000;
      const diff = due.getTime() - now.getTime();

      // due within the lead window (and not already past by more than 1 min)
      if (diff <= leadMs && diff > -60 * 1000) {
        const recipients = new Set([task.assignedEmail, task.ownerEmail]);

        for (const email of recipients) {
          if (!email) continue;
          const isOwnerCopy = email.toLowerCase() === task.ownerEmail.toLowerCase();

          const { subject, html } = reminderEmail({
            recipientName: nameFromEmail(email),
            taskTitle: task.title,
            dueDate: task.dueDate,
            isOwnerCopy: isOwnerCopy && task.type === "team",
          });

          await sendEmail({ to: email, subject, html });

          emitToEmail(email, "task:reminder", {
            taskId: task.id,
            title: task.title,
            dueDate: task.dueDate,
          });
        }

        Task.update(task.id, { reminderSentAt: new Date().toISOString() });
      }
    }
  });

  console.log("[scheduler] Reminder job started (runs every minute).");
}

module.exports = { startReminderJob };
