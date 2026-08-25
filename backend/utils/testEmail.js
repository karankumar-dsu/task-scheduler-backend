/**
 * Test script — checks that your SMTP / Gmail App Password is correctly
 * configured in .env before you rely on the full app to send emails.
 *
 * Usage:
 *   1. Fill SMTP_USER and SMTP_PASS in backend/.env
 *   2. Run:  node utils/testEmail.js your_email@example.com
 */
require("dotenv").config();
const { sendEmail } = require("./sendEmail");

const to = process.argv[2];

if (!to) {
  console.log("Usage: node utils/testEmail.js <recipient_email>");
  process.exit(1);
}

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.log(
    "\n⚠️  SMTP_USER / SMTP_PASS are not set in your .env file yet.\n" +
    "   Open backend/.env and fill them in first:\n" +
    "   SMTP_USER=your_email@gmail.com\n" +
    "   SMTP_PASS=16_digit_app_password\n"
  );
  process.exit(1);
}

(async () => {
  console.log(`Sending a test email to ${to} ...`);
  const result = await sendEmail({
    to,
    subject: "✅ Task Scheduler — Test Email",
    html: `
      <div style="font-family:Arial,sans-serif">
        <h2>SMTP setup working!</h2>
        <p>If you're seeing this email, your .env SMTP settings are correct
        and the "Task Scheduler" app will be able to send assignment and reminder emails.</p>
      </div>
    `,
  });

  if (result.simulated) {
    console.log("❌ Email was simulated (not actually sent) — please check SMTP_USER/SMTP_PASS.");
  } else if (result.error) {
    console.log("❌ An error occurred while sending the email:", result.error);
    console.log(
      "\nCommon fixes:\n" +
      "- Gmail: 2-Step Verification must be ON, and SMTP_PASS must be an App Password, not your real account password.\n" +
      "- Check that your firewall/network is not blocking SMTP port 465/587.\n"
    );
  } else {
    console.log("✅ Email sent successfully! Please check your inbox (and spam folder).");
  }
})();
