# Task Scheduler — Personal &amp; Team To-Do App

**Built by Karan Jaseja**

A full-stack web application (React + Node.js/Express) for managing personal and team tasks. Users can track their own work while assigning, tracking, and following up on tasks delegated to team members — with automated email notifications, real-time in-app reminders, pausable tasks, and a daily summary of anything left incomplete.

## 🧱 Tech Stack

- **Frontend**: React 19 (Vite), React Router, Socket.io Client, Axios
- **Backend**: Node.js, Express, Socket.io, JWT authentication, bcrypt, node-cron, Nodemailer
- **Data storage**: A lightweight JSON-file-based store (`backend/data/db.json`) — no external database installation required to get started. (This can later be swapped for MongoDB/PostgreSQL — only `models/User.js` and `models/Task.js` would need to change.)

## ✅ Features

- Sign up / Log in (JWT-based authentication)
- Separate Personal and Team task views
- Creating a team task automatically **emails the assigned member**
- Due date + time + priority (Low / Medium / High)
- As a deadline approaches (based on a configurable lead time), the system emails **both the assignee and the task creator**, and also shows a real-time in-app pop-up
- Task **Pause / Resume**
- Mark tasks complete / incomplete
- Dashboard statistics: Total, Completed, Incomplete (Pending), and Overdue task counts
- A **"missed tasks" notice** the next time the app is opened, summarizing anything left incomplete from previous days
- Delete task (only the original creator can delete)

## 📁 Folder Structure

```
todo-app/
├── backend/
│   ├── server.js              # Entry point
│   ├── routes/
│   │   ├── authRoutes.js      # register / login
│   │   └── taskRoutes.js      # CRUD, pause/resume, stats, missed tasks
│   ├── models/
│   │   ├── User.js
│   │   └── Task.js
│   ├── middleware/auth.js     # JWT verification
│   ├── utils/
│   │   ├── sendEmail.js       # Nodemailer wrapper
│   │   ├── scheduler.js       # node-cron reminder job (runs every minute)
│   │   ├── socket.js          # Socket.io real-time pop-ups
│   │   └── testEmail.js       # Standalone SMTP credential test script
│   ├── data/db.js             # JSON-file "database"
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/              # Login, Register, Dashboard
    │   ├── components/         # TaskCard, TaskForm, MissedTasksModal, ReminderToasts, StatsRing
    │   ├── context/             # AuthContext, SocketContext
    │   └── api/axios.js
    └── .env.example
```

## 🚀 Setup — Step by Step

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open the `.env` file and set the following:

```
JWT_SECRET=a_long_random_string

# For sending email via Gmail:
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_character_app_password
```

> **How to create a Gmail App Password**: Google Account → Security → 2-Step Verification (turn it ON if it isn't already) → App Passwords → generate a new one → paste it as `SMTP_PASS`. **Do not use your real Gmail login password.**
>
> If SMTP details are left blank, the app will still run — emails will simply be printed to the console in development mode instead of being sent.

**(Recommended) Test your SMTP credentials** before relying on the full app to send email:

```bash
node utils/testEmail.js your_test_email@example.com
```

If you see `✅ Email sent successfully!`, you're ready to go. If there's an error, the script explains the likely cause (2-Step Verification, App Password, or a network issue).

Start the backend:

```bash
npm run dev
```

The backend runs on `http://localhost:5000`.

### 2. Frontend

In a new terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend opens on `http://localhost:5173` (the exact link will be shown in the terminal).

### 3. Try it out

1. Register an account as the "Admin/Manager" (e.g. `manager@example.com`)
2. Register a second account as a "Team Member" (e.g. `member@gmail.com`) — use a real email address if you want to test the email notifications
3. Log in as the manager → "+ New Task" → Type = **Team** → enter the member's email → set a due date/time and reminder lead time → Create Task
4. Check the member's inbox — the assignment email should have arrived
5. As the due time approaches (within the reminder window), both accounts will receive a reminder email, and an in-app pop-up if the app is open
6. Leave a task incomplete, then reopen the app on a later date (or change your system date) — a "missed tasks" pop-up should appear

## 🌍 Deploying the App Online

Once you're happy with local testing, see **`DEPLOYMENT.md`** for a full step-by-step guide to deploying the backend on Render and the frontend on Vercel (both free tiers), so your team can access the app from anywhere.

## ⚠️ Known Limitations / Suggested Next Steps

- [ ] **Production database**: Currently uses a JSON file (fine for a demo/small deployment). For larger or concurrent usage, migrate to MongoDB (Mongoose) or PostgreSQL.
- [x] **Real SMTP credentials**: You'll need to add your own Gmail App Password to `.env` for real emails to be sent (otherwise they're printed to the console). See `utils/testEmail.js` to verify your setup.
- [ ] **Unregistered assignees**: If the assigned email doesn't have an account yet, they will still receive the notification email, but they won't be able to view the task in-app until they register. A future "invite link" flow could improve this.
- [ ] **Push notifications when the app is closed**: Currently, pop-ups and Socket.io events only work while the app is open in a browser tab. Adding the Web Push API / a Service Worker would allow notifications even when the app is closed.
- [ ] **"Forgot Password" flow**: Not yet implemented.
- [ ] **Role-based permissions**: Currently any user can create and assign team tasks. If you need to restrict this so only a designated "Admin/Manager" role can assign team tasks, a `role` field would need to be added.
- [x] **Deployment**: `DEPLOYMENT.md` includes a full free-tier guide for Render (backend) + Vercel (frontend).
- [ ] **Testing at scale**: Bulk testing (many tasks, many team members on one task) has not been performed — the app is ready for a small demo/classroom-scale deployment.
- [ ] **UI polish (optional)**: Basic mobile responsiveness is included; dark mode is not yet implemented.

These are optional next steps — **the core requirements (personal + team tasks, automatic assignment email, deadline reminders via email and pop-up, task pausing, task counts, and the next-day "missed task" notice) are already implemented** and included in this package as working code.
