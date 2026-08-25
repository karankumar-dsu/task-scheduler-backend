const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      "[email] SMTP_USER / SMTP_PASS not set in .env — emails will be logged to console instead of sent."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE) !== "false",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const t = getTransporter();

  if (!t) {
    // Fallback for dev/demo mode
    console.log("----- [DEV EMAIL - not actually sent] -----");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log(html ? html.replace(/<[^>]+>/g, " ") : "");
    console.log("--------------------------------------------");
    return { simulated: true };
  }

  const fromName = process.env.SMTP_FROM_NAME || "Todo App";

  try {
    await t.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return { simulated: false };
  } catch (err) {
    console.error("[email] Failed to send:", err.message);
    return { simulated: false, error: err.message };
  }
}

// 1. Task Assigned Email Template
function taskAssignedEmail({ assigneeName, taskTitle, dueDate, assignerName }) {
  return {
    subject: `New task assigned to you: ${taskTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>You have a new task</h2>
        <p>Hi ${assigneeName || ""},</p>
        <p><strong>${assignerName}</strong> assigned you a new task:</p>
        <p style="font-size:16px"><strong>${taskTitle}</strong></p>
        ${dueDate ? `<p>Due: <strong>${new Date(dueDate).toLocaleString()}</strong></p>` : ""}
        <p>Please open the Todo App to see details.</p>
      </div>
    `,
  };
}

// 2. Task Reminder Email Template
function reminderEmail({ recipientName, taskTitle, dueDate, isOwnerCopy }) {
  return {
    subject: `Reminder: "${taskTitle}" is due soon`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>⏰ Deadline approaching</h2>
        <p>Hi ${recipientName || ""},</p>
        <p>${
          isOwnerCopy
            ? "A task you assigned is approaching its deadline:"
            : "A task assigned to you is approaching its deadline:"
        }</p>
        <p style="font-size:16px"><strong>${taskTitle}</strong></p>
        <p>Due: <strong>${new Date(dueDate).toLocaleString()}</strong></p>
      </div>
    `,
  };
}

// 3. OTP Reset Password Email Template
function otpEmail({ name, otp }) {
  return {
    subject: "Password Reset OTP - Todo App",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:500px;margin:auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px">
        <h2 style="color:#333;text-align:center">Password Reset Request</h2>
        <p>Hi ${name || "User"},</p>
        <p>Aapne password reset karne ki request ki thi. Niche diya gaya OTP enter karke apna password change karein:</p>
        <div style="text-align:center;margin:20px 0">
          <span style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#f4f4f4;padding:10px 20px;border-radius:4px;color:#2c3e50">${otp}</span>
        </div>
        <p style="color:#666;font-size:14px">Yeh OTP <strong>10 minute</strong> tak valid hai.</p>
        <p style="color:#999;font-size:12px;margin-top:20px">Agar aapne yeh request nahi ki, toh is email ko ignore karein.</p>
      </div>
    `,
  };
}

module.exports = { sendEmail, taskAssignedEmail, reminderEmail, otpEmail };