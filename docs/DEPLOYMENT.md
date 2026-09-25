# CareerAI — Deployment Guide (0% to 100%, Free Tier Only)

This guide takes you from "I have the source code" to "my CareerAI site is live
on the internet with a real URL," using only free tiers. No credit card is
required for any step marked 🆓. A few optional steps need a card for identity
verification only (still $0 charged) — those are marked ⚠️.

**Total time: 45–90 minutes.** Follow the phases in order — each one depends on
the last.

---

## What you'll end up with

```
https://your-app.vercel.app          ← your live frontend (React)
https://your-api.onrender.com        ← your live backend (FastAPI)
Neon.tech                            ← your live PostgreSQL database
Resend.com                           ← sends real verification emails
OpenAI or Anthropic                  ← powers the AI analysis
GitHub                               ← hosts your code + auto-deploys on push
```

---

## Phase 0 — Prerequisites

- [ ] A GitHub account (free) — https://github.com/join
- [ ] Node.js installed on your computer (to test locally first) — https://nodejs.org
- [ ] Python 3.11+ installed locally — https://python.org
- [ ] Git installed — https://git-scm.com
- [ ] The `careerai-source.zip` file from this conversation, unzipped somewhere on your computer

Unzip it now:
```bash
unzip careerai-source.zip
cd careerai
```

---

## Phase 1 — Push your code to GitHub 🆓

Your code needs to live on GitHub so Vercel and Render can deploy directly
from it.

1. Go to https://github.com/new
2. Repository name: `careerai` (or anything you like)
3. Keep it **Public** or **Private** — both work with free tiers
4. Do **NOT** check "Add a README" (you already have one)
5. Click **Create repository**
6. GitHub will show you commands — back in your terminal, inside the
   `careerai` folder, run:

```bash
git init
git add .
git commit -m "Initial commit — CareerAI"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/careerai.git
git push -u origin main
```

**Check:** Refresh your GitHub repo page — you should see all your folders
(`frontend/`, `backend/`, `docs/`, etc.).

⚠️ **Before you push**, double check `.env` files are NOT in your repo (they
shouldn't be — `.gitignore` already excludes them). Run this to confirm:
```bash
git status
```
You should never see `backend/.env` or `frontend/.env.local` listed.

---

## Phase 2 — Create your free PostgreSQL database (Neon) 🆓

Neon gives a genuinely free, always-on PostgreSQL database — no credit card.

1. Go to https://neon.tech and click **Sign up** (use your GitHub account to
   sign in — fastest option)
2. Click **Create a project**
   - Project name: `careerai`
   - Region: pick the one closest to you
   - Postgres version: leave default
3. Click **Create project**
4. On the project dashboard, find the **Connection string** box. It looks
   like:
   ```
   postgresql://neondb_owner:AbCdEf123@ep-cool-name-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. **Copy this entire string** — you'll need it in Phase 4. Keep this tab
   open.

**Check:** You should see "Project created" and a green "Active" status.

---

## Phase 3 — Get a free AI API key (OpenAI or Anthropic) 🆓/⚠️

You need one of these for the AI analysis pipeline to work. Both offer a
starting free credit; OpenAI currently requires a card on file to activate
API access even when using free credits — Anthropic's console has historically
allowed a no-card trial credit, but offers change, so check both at signup
time and pick whichever doesn't require a card for you.

### Option A — OpenAI (used by default in this project)
1. Go to https://platform.openai.com/signup
2. Verify your email and phone number
3. Go to https://platform.openai.com/api-keys
4. Click **Create new secret key**, name it `careerai`, click **Create**
5. **Copy the key immediately** — it starts with `sk-...` and is shown only
   once. Save it somewhere safe.
6. Go to https://platform.openai.com/settings/organization/billing and check
   if you have free trial credit. If not, add a small amount (as little as
   $5) — the project's rate limits keep usage very low for testing.

### Option B — Anthropic (Claude)
1. Go to https://console.anthropic.com
2. Sign up and verify your email
3. Go to **API Keys** → **Create Key**, name it `careerai`
4. Copy the key — it starts with `sk-ant-...`
5. If using Anthropic, you'll set `LLM_PROVIDER=anthropic` and
   `LLM_MODEL=claude-3-5-haiku-20241022` in your environment variables later
   (Phase 4). Note: this project still calls OpenAI for **embeddings**
   specifically (`text-embedding-3-small`), so if you go this route you may
   want an OpenAI key too just for embeddings, or skip embeddings by using a
   fallback score (the pipeline already degrades gracefully if embeddings
   fail — see `ai_service.py`).

**Check:** You have a key starting with `sk-` or `sk-ant-` saved somewhere.

---

## Phase 4 — Get free transactional email (Resend) 🆓

Resend's free tier sends 3,000 emails/month and 100/day — plenty for a
portfolio project and real OTP verification emails.

1. Go to https://resend.com/signup — sign up with GitHub or email
2. Verify your email
3. Go to **API Keys** in the left sidebar → **Create API Key**
   - Name: `careerai`
   - Permission: **Full access**
4. Copy the key — it starts with `re_...`
5. **Domain setup (important):** Resend's free tier lets you send from
   `onboarding@resend.dev` immediately with zero setup — good enough for
   testing and even for real portfolio use. If you own a domain and want
   emails from your own address, go to **Domains** → **Add Domain** and
   follow their DNS instructions (adds ~10 minutes, fully free, optional).

**Check:** You have an API key starting with `re_` and know whether you're
using `onboarding@resend.dev` or your own verified domain as the "from"
address.

---

## Phase 5 — Get free Google OAuth credentials (optional) 🆓

Skip this phase if you don't need "Continue with Google" to work — the button
will show a clean "not configured" message instead of breaking, so the app
works fine without it.

1. Go to https://console.cloud.google.com
2. Click **Select a project** → **New Project** → name it `CareerAI` → **Create**
3. In the search bar, type "OAuth consent screen" and open it
   - User Type: **External** → **Create**
   - App name: `CareerAI`, fill in your email in the required fields
   - Click through **Save and Continue** on each screen (Scopes, Test users
     can be skipped/defaulted) until you reach the summary, then **Back to
     Dashboard**
4. In the search bar, type "Credentials" and open it
5. Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `CareerAI Web`
   - Authorized redirect URIs → **Add URI**:
     `https://your-api.onrender.com/auth/google/callback`
     (you'll get your actual Render URL in Phase 7 — come back and add it
     then, or add a placeholder now and edit it later from this same screen)
6. Click **Create** — a popup shows your **Client ID** and **Client Secret**.
   Copy both.

**Check:** You have a Client ID (ends in `.apps.googleusercontent.com`) and a
Client Secret.

---

## Phase 6 — Run the database migration 🆓

Before deploying, create your tables in the new Neon database.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` folder (copy from `.env.example`) and
set at minimum:
```
DATABASE_URL=postgresql+asyncpg://neondb_owner:AbCdEf123@ep-cool-name-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
```
(Take your Neon connection string from Phase 2, and change `postgresql://`
to `postgresql+asyncpg://` at the start — this project uses the async driver.)

Then run:
```bash
alembic upgrade head
```

**Check:** You should see output ending in something like
`Running upgrade ... -> 0001_initial, Initial migration`. Go back to your
Neon dashboard → **Tables** — you should now see `users`, `resumes`,
`analyses`, and 12 other tables.

---

## Phase 7 — Deploy the backend (Render) 🆓

Render's free web service tier is enough for a portfolio project (it sleeps
after 15 minutes of inactivity and wakes on the next request within ~30
seconds — totally fine for demos and interviews).

1. Go to https://render.com and sign up with GitHub
2. Click **New +** → **Web Service**
3. Connect your GitHub account if prompted, then select your `careerai` repo
4. Configure:
   - **Name:** `careerai-api` (this becomes part of your URL)
   - **Region:** closest to you
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** **Free**
5. Scroll to **Environment Variables** and add each of these (values from
   Phases 2–5):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string (with `+asyncpg`) |
   | `JWT_SECRET` | run `python3 -c "import secrets; print(secrets.token_hex(32))"` locally and paste the output |
   | `ENV` | `production` |
   | `DEBUG` | `false` |
   | `FRONTEND_URL` | `https://your-app.vercel.app` (you'll get this in Phase 8 — come back and update it, or guess your Vercel project name now since Vercel URLs are predictable: `https://<project-name>.vercel.app`) |
   | `LLM_PROVIDER` | `openai` (or `anthropic`) |
   | `LLM_API_KEY` | your key from Phase 3 |
   | `LLM_MODEL` | `gpt-4o-mini` (or `claude-3-5-haiku-20241022`) |
   | `EMBEDDING_MODEL` | `text-embedding-3-small` |
   | `EMAIL_PROVIDER` | `resend` |
   | `RESEND_API_KEY` | your key from Phase 4 |
   | `EMAIL_FROM` | `onboarding@resend.dev` (or your verified domain) |
   | `GOOGLE_CLIENT_ID` | from Phase 5, or leave blank to skip |
   | `GOOGLE_CLIENT_SECRET` | from Phase 5, or leave blank to skip |
   | `GOOGLE_REDIRECT_URI` | `https://careerai-api.onrender.com/auth/google/callback` |

6. Click **Create Web Service**
7. Render will build and deploy — this takes 3–5 minutes the first time.
   Watch the **Logs** tab for `Application startup complete`.

**Check:** Visit `https://careerai-api.onrender.com/health` (use your actual
Render URL, shown at the top of your service dashboard) — you should see:
```json
{"status": "ok", "version": "0.1.0"}
```

If you see an error instead, check the **Logs** tab on Render for the actual
error message.

---

## Phase 8 — Deploy the frontend (Vercel) 🆓

1. Go to https://vercel.com and sign up with GitHub
2. Click **Add New** → **Project**
3. Import your `careerai` GitHub repo
4. Configure:
   - **Framework Preset:** Vite (should auto-detect)
   - **Root Directory:** click **Edit** → select `frontend`
   - **Build Command:** `npm run build` (default, leave as-is)
   - **Output Directory:** `dist` (default, leave as-is)
5. Expand **Environment Variables** and add:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://careerai-api.onrender.com` (your actual Render URL from Phase 7) |

6. Click **Deploy**
7. Wait ~60–90 seconds for the build.

**Check:** Vercel shows a **Congratulations** screen with a live URL like
`https://careerai-xyz123.vercel.app`. Click it — your landing page should
load.

---

## Phase 9 — Connect the two (update CORS + OAuth) 🆓

Now that both are live, go back and fix the two places that referenced
placeholder URLs:

1. **Render** → your `careerai-api` service → **Environment** → edit
   `FRONTEND_URL` to your real Vercel URL from Phase 8 (e.g.
   `https://careerai-xyz123.vercel.app`) → **Save Changes** (this triggers an
   automatic redeploy, ~2 minutes)

2. **If you set up Google OAuth in Phase 5:** go back to
   https://console.cloud.google.com → **Credentials** → click your OAuth
   client → update the **Authorized redirect URI** to your real Render URL:
   `https://careerai-api.onrender.com/auth/google/callback` → **Save**

**Check:** Wait for Render to finish redeploying (check the **Events** tab),
then visit your Vercel URL again, click **Get Started**, and try signing up
with a real email address you can check.

---

## Phase 10 — Test the full live flow ✅

Go through this checklist on your live site:

- [ ] Landing page loads, light/dark toggle works
- [ ] Sign up with a real email → you receive an actual OTP email within
      ~10 seconds (check spam folder first time)
- [ ] Enter the OTP → "Email verified"
- [ ] Log in
- [ ] Dashboard loads
- [ ] Upload a real PDF or DOCX resume
- [ ] Paste a real job description (100+ characters)
- [ ] Click **Analyze Resume & Job** → watch it go QUEUED → PROCESSING →
      COMPLETED (takes 30–90 seconds — this is real AI, not a mock)
- [ ] View the ATS score, skill gaps, projects, interview questions,
      roadmap, and resume suggestions
- [ ] Try the **Copy as text** / **Download .txt** buttons on the ATS tab
- [ ] Check Settings → Active Sessions
- [ ] Log out

If every box is checked, **your CareerAI is fully live.** 🎉

---

## Costs — what stays free forever vs. what to watch

| Service | Free tier limit | What happens if exceeded |
|---|---|---|
| Neon (database) | 0.5 GB storage, autosuspends when idle | Free forever at this scale for a portfolio project |
| Render (backend) | 750 hours/month, sleeps after 15 min idle | Free forever; only limit is a ~30s cold-start wake-up |
| Vercel (frontend) | 100 GB bandwidth/month | Effectively unlimited for personal/portfolio traffic |
| Resend (email) | 3,000 emails/month, 100/day | More than enough; upgrade only needed at real scale |
| OpenAI API | Pay-as-you-go after free credit | This is the only real cost — budget ~$1-3/month for light testing use with `gpt-4o-mini` |

**To minimize AI cost:** the project already caches analysis results (never
re-runs the pipeline for the same resume+JD pair) and uses the cheap
`gpt-4o-mini` model by default — see `RATE_LIMIT_AI` in `.env.example` if you
want to lower limits further.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Render shows "Application failed to respond" | Check **Logs** tab — usually a missing environment variable |
| OTP email never arrives | Check Resend dashboard → **Logs** to see if it was sent; check spam folder |
| "CORS error" in browser console | `FRONTEND_URL` on Render doesn't exactly match your Vercel URL (must include `https://`, no trailing slash) |
| Google login shows "not configured" | Expected if you skipped Phase 5 — everything else still works |
| Analysis stuck on "Processing" forever | Check Render logs for an LLM API error — usually an invalid/expired API key or no credit remaining |
| `alembic upgrade head` fails locally | Double-check `DATABASE_URL` uses `postgresql+asyncpg://` not `postgresql://` |

---

## What's next (optional, still free)

- **Custom domain:** Vercel and Render both let you attach a free custom
  domain (you still pay the domain registrar, e.g. ~$10/year, but the
  hosting itself stays free)
- **Uptime monitoring:** https://uptimerobot.com free tier can ping your
  Render backend every 5 minutes to prevent cold-start sleep during a
  live interview demo
- **GitHub Actions CI:** add a `.github/workflows/test.yml` that runs
  `pytest` on every push — free for public repos, 2,000 minutes/month free
  for private repos
