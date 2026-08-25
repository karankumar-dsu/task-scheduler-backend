# Deployment Guide — Taking Task Scheduler Live

This guide explains how to deploy your local project to the internet, so you and your team can use the app from anywhere — not just `localhost`.

We'll use **free-tier** services:
- **Backend** → Render.com
- **Frontend** → Vercel.com

> ⚠️ **Important note first**: This project's data storage is currently a JSON file (`backend/data/db.json`). On free hosting platforms like Render, the filesystem is **ephemeral** — meaning the file can be reset when the server restarts. This is fine for a small demo or class submission, but if you need data to persist permanently, see Section 5 (MongoDB Atlas free tier).

---

## 1. Push your code to GitHub

Deployment platforms connect directly to a GitHub repository.

```bash
cd todo-app
git init
git add .
git commit -m "Initial commit - Task Scheduler todo app"
```

Create a new repository on GitHub (github.com/new), then:

```bash
git remote add origin https://github.com/<your-username>/taskflow-todo-app.git
git branch -M main
git push -u origin main
```

> Don't push `node_modules`, `.env`, or `backend/data/db.json` — both `backend` and `frontend` already have a `.gitignore` that excludes `node_modules` and `.env`.

---

## 2. Deploy the backend (Render.com)

1. Create an account at [render.com](https://render.com) (you can sign in with GitHub).
2. Dashboard → **New +** → **Web Service**.
3. Select your GitHub repository.
4. Configure the following settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Under **Environment Variables**, add the following (copy from your `.env.example` and fill in real values):
   ```
   JWT_SECRET=a_long_random_string
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_FROM_NAME=Task Scheduler
   REMINDER_LEAD_MINUTES=30
   CLIENT_URL=https://your-frontend-url.vercel.app
   ```
   (Leave `CLIENT_URL` blank for now — you'll come back and fill it in after completing Section 3.)
6. Click **Create Web Service**. Render will build the project and give you a URL, e.g.:
   `https://taskflow-backend.onrender.com`
   — note this URL, you'll need it in the next step.

> Free tier note: Render's free web service "sleeps" after a period of inactivity, so the first request may take 30–60 seconds to wake it up — this is normal, not a bug.

---

## 3. Deploy the frontend (Vercel.com)

1. Sign in to [vercel.com](https://vercel.com) with GitHub.
2. **Add New** → **Project** → select your repository.
3. Under settings:
   - **Root Directory**: `frontend`
   - Framework Preset: Vite (auto-detected)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   ```
   VITE_API_URL=https://taskflow-backend.onrender.com/api
   ```
   (Use your actual Render backend URL from Step 2, with `/api` appended.)
5. Click **Deploy**. Within a few minutes, Vercel will give you a live URL, e.g.:
   `https://taskflow-todo-app.vercel.app`

---

## 4. Update the backend with the frontend URL (CORS)

Go back to the Render dashboard → your backend service → **Environment** → update `CLIENT_URL` with your actual Vercel URL:

```
CLIENT_URL=https://taskflow-todo-app.vercel.app
```

Render will automatically redeploy the backend once you save. Without this step, the frontend won't be able to communicate with the backend (you'll see a CORS error).

---

## 5. (Recommended) Persist data permanently — MongoDB Atlas

Free-tier hosting can reset file-based storage. If you'd like your data to persist permanently:

1. Create a free account and an M0 (free) cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user and copy the connection string (it will look like: `mongodb+srv://user:pass@cluster.mongodb.net/taskflow`).
3. Install Mongoose in the backend: `npm install mongoose`
4. Replace `backend/data/db.js` with Mongoose models (`User` and `Task` schemas) — if you'd like, I can build this migration for you, just ask.
5. In Render, add a new environment variable: `MONGODB_URI=<your connection string>`

> This step is optional — the current file-based setup works fine for a small class assignment or demo.

---

## 6. Final Testing Checklist

- [ ] Open the live frontend URL and test registration/login
- [ ] Create a team task and confirm the assignment email is sent
- [ ] Set a task's due time a few minutes in the future and confirm the reminder email + in-app pop-up appear
- [ ] Log in as two different users on two devices/browsers to test the real-time pop-up
- [ ] Open the app on a mobile browser as well (responsive check)

---

## Quick Reference — Where the URLs go

| What | Where | Value |
|---|---|---|
| Backend live URL | Vercel env var `VITE_API_URL` | `https://<backend>.onrender.com/api` |
| Frontend live URL | Render env var `CLIENT_URL` | `https://<frontend>.vercel.app` |

Both URLs point to each other — if either one changes, remember to update the other.
