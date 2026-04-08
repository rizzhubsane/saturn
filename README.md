# EventX — WhatsApp Event Discovery Agent for IIT Delhi

A WhatsApp-based event discovery platform where clubs post events by DMing a bot, and students query, search, save, and get reminded about campus events. Zero behavior change for clubs — same publicity message, now made intelligent.

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill environment variables
cp .env.example .env

# Run the database migration
# → Go to Supabase SQL Editor and run: supabase/migrations/001_initial_schema.sql

# Create the poster storage bucket in Supabase:
# → Storage → New Bucket → Name: "posters" → Public: ON

# Start development server
npm run dev
```

## Architecture

```
WhatsApp → Meta Cloud API → Express Webhook → Message Router → Handler
                                                                  ↓
                                              LLM (Gemini 2.5 Flash via OpenRouter)
                                                                  ↓
                                              Supabase (Postgres + Storage)
```

## Commands

### For Students
- `/today`, `/tomorrow`, `/week` — time-based event queries
- `/search <keyword>` — search events
- `/clubs` — browse all clubs
- `/club <name>` — club profile & events
- `/save <id>`, `/saved` — bookmark events
- `/remind <id>` — set event reminders
- `/subscribe <category>` — daily digest for a category
- Natural language: "any hackathons this week?"

### For Club Team (Power Users)
- `/post` — post event (text + poster image)
- `/myevents` — your posted events
- `/clubinfo` — club profile & stats

### For Club Admins
- `/register <name>` — register your club
- `/adduser <phone>` — add team member
- `/removeuser <phone>` — remove member
- `/editclub` — edit club profile
- `/analytics` — event analytics
- `/orginfo` — org details

### For God (Developer)
- `/addorg <name>` — create a club
- `/promote <phone> admin <club>` — promote user
- `/broadcast <msg>` — message all users
- `/stats` — system stats
- `/purge` — expire past events

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | Supabase (Postgres) |
| LLM | Gemini 2.5 Flash via OpenRouter |
| WhatsApp | Meta Cloud API v21.0 |
| Image Processing | Sharp |
| Scheduler | node-cron |
| Deployment | Railway |

## Environment Variables

See `.env.example` for the full list. Key ones:

- `WHATSAPP_PHONE_NUMBER_ID` — from Meta Business Manager
- `WHATSAPP_ACCESS_TOKEN` — permanent system user token
- `WHATSAPP_VERIFY_TOKEN` — custom string for webhook verification  
- `WHATSAPP_APP_SECRET` — for signature validation
- `OPENROUTER_API_KEY` — from openrouter.ai
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `GOD_PHONE` — your phone number (E.164 format)

## Deployment

1. Push to GitHub
2. Connect to Railway
3. Set all env vars in Railway dashboard
4. Railway auto-deploys and provides a public URL
5. Set the URL as webhook in Meta App Dashboard: `https://your-app.railway.app/webhook`

## Project Structure

```
src/
├── index.ts              # Express server entry
├── config/               # Env vars, venues, categories
├── webhook/              # Meta webhook handling
├── router/               # Message routing
├── handlers/             # Command handlers (14 files)
├── services/             # WhatsApp, LLM, image, search, scheduler
├── db/                   # Supabase client + queries
├── utils/                # Date parsing, formatting, dedup
└── types/                # TypeScript interfaces
```
