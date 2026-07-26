# Anupam Outreach v2.0 — Marketing Command Center

Full-featured marketing CRM for Anupam Paints. AI-powered prospect research, email drafting, Gmail sending, WhatsApp messaging, pipeline tracking, team collaboration.

## Features

- **Dashboard** — Live stats, pipeline view, pending follow-ups, activity feed
- **AI Outreach** — Research company → Draft personalized email → Send via Gmail → WhatsApp
- **Contacts CRM** — Pipeline stages (New → Emailed → Responded → Meeting → Won)
- **Communication History** — Every email and WhatsApp per contact
- **Follow-up Scheduler** — Never miss a follow-up
- **Style Training** — AI learns your email writing style
- **Team Management** — Add team members, track who did what
- **Activity Log** — Full audit trail

## Tech Stack

- **Next.js 14** — React framework
- **Supabase** — PostgreSQL database + auth (free tier)
- **Vercel** — Hosting (free tier)
- **Nodemailer** — Gmail sending
- **Anthropic API** — AI research & drafting

---

## Setup Guide (20 minutes)

### 1. Create Supabase Project (5 min)

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name: `anupam-outreach`, set a DB password, region: Mumbai
3. Wait for project to initialize
4. Go to **SQL Editor** → **New Query**
5. Copy-paste the contents of `supabase/schema.sql` → **Run**
6. Go to **Project Settings → API**:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **service_role key** (not anon!) → `SUPABASE_SERVICE_KEY`

### 2. Get API Keys (5 min)

**Anthropic API:**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key → copy it
3. Add $20 credit (covers thousands of outreaches)

**Gmail App Password:**
1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable 2-Step Verification
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Create → Mail → Other → "Outreach" → copy the 16-char password

### 3. Deploy to Vercel (5 min)

1. Push code to GitHub:
```bash
git init && git add . && git commit -m "v2.0"
gh repo create anupam-outreach --private --push
```

2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the GitHub repo
4. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJhbGci...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GMAIL_USER` | `anupam@anupampaints.com` |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` |
| `TEAM_PIN` | `1972` |

5. Deploy!

### 4. Add Custom Domain (optional)

Vercel → Settings → Domains → Add `outreach.anupampaints.com`

### 5. Add Team Members

1. Login as admin (anupam@anupampaints.com)
2. Go to Team tab → Add members by name + email
3. Share the URL + PIN with them

---

## Usage

### For Anupam Sir
1. Login at the app URL
2. Go to **Training** → paste 3-4 of your actual outreach emails
3. The AI will match your tone in all future drafts

### For Team Members
1. Login with registered email + team PIN
2. **New Outreach**: Enter prospect → AI researches → drafts email → send → WhatsApp
3. **Contacts**: Track pipeline, view history, schedule follow-ups
4. **Dashboard**: See team stats and pending tasks

### Screenshot Workflow
Since the app can't process images directly:
1. User takes LinkedIn screenshot
2. Reads the profile manually → enters in Manual Entry
3. OR: Sends screenshot to Claude chat → Claude extracts → user enters

---

## Cost

| Service | Cost |
|---|---|
| Vercel | Free (hobby plan) |
| Supabase | Free (500MB, 50K requests/mo) |
| Anthropic API | ~₹2-3 per outreach |
| Gmail | Free (500 emails/day limit) |

**Total: ~₹0/month fixed + ₹2-3 per prospect contacted**

---

## Local Development

```bash
npm install
cp .env.local.example .env.local
# Fill in values
npm run dev
```

## Security

- API keys are server-side only (never sent to browser)
- Team PIN provides access control
- Supabase RLS enabled
- All actions logged with user attribution
