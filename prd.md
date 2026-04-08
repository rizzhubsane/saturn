# PRD: IITD Events WhatsApp Agent

## 1. Overview

A WhatsApp-based event discovery platform for IIT Delhi. Clubs post events by DMing a bot with their standard publicity message (text + poster image). The bot parses, structures, and stores events. Events are broadcast to a WhatsApp Community channel. Students DM the bot to search, filter, set reminders, and get personalized digests.

**Core Insight:** Clubs already produce semi-structured publicity content (poster + text). This system intercepts that existing behavior and makes it queryable, discoverable, and filterable — zero behavior change on the supply side.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js + TypeScript | Async-native, best Meta webhook support, strong Cursor/AI-IDE compatibility |
| Framework | Express.js | Lightweight, perfect for webhook listener pattern |
| Database | Supabase (Postgres) | Managed Postgres + built-in storage (for poster images) + Row Level Security + realtime capabilities |
| LLM | Gemini 2.5 Flash via OpenRouter | Fast, cheap, good at structured extraction. Accessed via OpenRouter API |
| WhatsApp API | Meta Cloud API (v21.0+) | Direct integration, supports interactive messages (buttons, lists), template messages for reminders |
| Deployment | Railway | Simple, supports long-running Node processes, easy env var management, auto-deploy from GitHub |
| Scheduler | node-cron (in-process) | For broadcast digests and reminder triggers. Upgrade to BullMQ + Redis if scale demands |
| Image Processing | Sharp (Node.js) | Resize/compress poster images before storing in Supabase Storage |

---

## 3. Actors & Roles

### 3.1 God (Developer)
- Full system access
- Can promote any user to Admin
- Manages WhatsApp Business Account, Meta app config, webhook setup
- Accesses Supabase dashboard directly
- Manages approved message templates in Meta Business Manager

### 3.2 Admin (Club Lead)
- One per club/society
- Registers their club on the platform via DM: `/register <club_name>`
- Receives a unique 6-character alphanumeric invite code
- Shares code with their publicity person(s) to onboard them as Power Users
- Can remove Power Users from their club
- Can edit/cancel any event posted by their club

### 3.3 Power User (Publicity Person)
- Joins a club by DMing bot: `/join <invite_code>`
- Posts events by sending `/post` followed by the club's standard WhatsApp publicity message (text + optional poster image)
- Receives parsed preview for confirmation before event goes live
- Can edit or cancel their own posted events
- Receives post-event analytics (views, saves, reminders set)

### 3.4 User (Student)
- Any IIT Delhi student who DMs the bot
- On first message, goes through lightweight onboarding (interest selection via buttons)
- Can search, browse, filter, save, and set reminders for events
- Can subscribe to categories for daily personal digests
- Interacts primarily via WhatsApp interactive messages (buttons, list pickers) — slash commands supported but not required

---

## 4. Database Schema (Supabase / Postgres)

### 4.1 Tables

```sql
-- Clubs table
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE, -- lowercase, hyphenated, used internally
  invite_code TEXT NOT NULL UNIQUE, -- 6-char alphanumeric, generated on registration
  admin_phone TEXT NOT NULL, -- WhatsApp phone number of admin (E.164 format)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (all actors who DM the bot)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE, -- E.164 format, e.g. +919876543210
  name TEXT, -- WhatsApp profile name, captured on first message
  role TEXT NOT NULL DEFAULT 'user', -- 'god', 'admin', 'power_user', 'user'
  club_id UUID REFERENCES clubs(id), -- NULL for regular users, set for admin/power_user
  interests TEXT[] DEFAULT '{}', -- array of category slugs, e.g. {'tech','cultural'}
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id),
  posted_by UUID NOT NULL REFERENCES users(id), -- the power user who posted
  title TEXT NOT NULL,
  description TEXT, -- cleaned/summarized description
  raw_message TEXT NOT NULL, -- original WhatsApp message text, preserved
  date DATE NOT NULL, -- event date
  time TIME, -- event start time (nullable if "all day" or not specified)
  end_time TIME, -- optional end time
  venue TEXT, -- parsed venue name
  venue_normalized TEXT, -- standardized venue name (e.g. "LHC" -> "Lecture Hall Complex")
  categories TEXT[] NOT NULL DEFAULT '{}', -- e.g. {'tech','career','startup'}
  registration_link TEXT, -- extracted URL if present
  poster_url TEXT, -- Supabase Storage public URL for poster image
  poster_ocr_text TEXT, -- OCR-extracted text from poster image
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled', 'expired'
  is_express BOOLEAN DEFAULT FALSE, -- if true, broadcast immediately (not in digest)
  broadcast_sent BOOLEAN DEFAULT FALSE, -- whether this event has been included in a community broadcast
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  remind_at TIMESTAMPTZ NOT NULL, -- when to send the reminder (e.g. 1 hour before event)
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id) -- one reminder per user per event
);

-- Saved/bookmarked events
CREATE TABLE saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  event_id UUID NOT NULL REFERENCES events(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Subscriptions (category-based daily digests)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL, -- e.g. 'tech', 'cultural'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- Analytics / view tracking
CREATE TABLE event_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID REFERENCES users(id), -- nullable (community views are anonymous)
  source TEXT NOT NULL DEFAULT 'dm', -- 'community' or 'dm'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_categories ON events USING GIN(categories);
CREATE INDEX idx_events_club ON events(club_id);
CREATE INDEX idx_reminders_pending ON reminders(remind_at) WHERE sent = FALSE;
CREATE INDEX idx_users_phone ON users(phone);
```

### 4.2 Venue Normalization Map

Store as a JSON config file (`src/config/venues.json`), not in DB. Maps common shorthand to full names:

```json
{
  "lhc": "Lecture Hall Complex",
  "sac": "Student Activity Centre",
  "bharti": "Bharti Building",
  "dogra": "Dogra Hall",
  "masala mix": "Masala Mix Canteen",
  "bss": "Block Service Scheme",
  "seminar hall": "Seminar Hall",
  "open air theatre": "Open Air Theatre (OAT)",
  "oat": "Open Air Theatre (OAT)",
  "main building": "Main Building",
  "kd jaffe": "KD Jaffe House"
}
```

### 4.3 Category Taxonomy

Fixed set of categories. Stored in config, not DB:

```json
{
  "categories": [
    { "slug": "tech", "label": "Tech & Coding", "emoji": "💻" },
    { "slug": "cultural", "label": "Cultural", "emoji": "🎭" },
    { "slug": "sports", "label": "Sports & Fitness", "emoji": "⚽" },
    { "slug": "career", "label": "Career & Placement", "emoji": "💼" },
    { "slug": "startup", "label": "Startup & Business", "emoji": "🚀" },
    { "slug": "academic", "label": "Academic & Research", "emoji": "📚" },
    { "slug": "social", "label": "Social & Chill", "emoji": "🎉" },
    { "slug": "workshop", "label": "Workshops & Hands-on", "emoji": "🔧" },
    { "slug": "talk", "label": "Talks & Lectures", "emoji": "🎤" },
    { "slug": "competition", "label": "Competitions", "emoji": "🏆" }
  ]
}
```

---

## 5. Project Structure

```
iitd-events-bot/
├── src/
│   ├── index.ts                    # Express app entry point, webhook route setup
│   ├── config/
│   │   ├── env.ts                  # Environment variable validation & export
│   │   ├── venues.json             # Venue normalization map
│   │   └── categories.json         # Category taxonomy
│   ├── webhook/
│   │   ├── handler.ts              # Main webhook POST handler — receives all WhatsApp messages
│   │   ├── verify.ts               # GET handler for Meta webhook verification (challenge-response)
│   │   └── signature.ts            # Validates X-Hub-Signature-256 header for security
│   ├── router/
│   │   └── messageRouter.ts        # Routes incoming messages to correct handler based on user role + intent
│   ├── handlers/
│   │   ├── onboarding.ts           # First-time user flow: welcome message + interest selection
│   │   ├── postEvent.ts            # Power User: /post command — receives message, triggers parsing, sends preview
│   │   ├── confirmEvent.ts         # Power User: handles confirm/edit/cancel responses to parsed preview
│   │   ├── registerClub.ts         # Admin: /register command — creates club, generates invite code
│   │   ├── joinClub.ts             # Power User: /join command — links user to club
│   │   ├── queryEvents.ts          # User: handles /today, /tomorrow, /week, /search, natural language queries
│   │   ├── reminders.ts            # User: set/cancel/view reminders
│   │   ├── savedEvents.ts          # User: save/unsave/view saved events
│   │   ├── subscriptions.ts        # User: /subscribe, /unsubscribe category digests
│   │   └── help.ts                 # Responds with available commands based on user role
│   ├── services/
│   │   ├── whatsapp.ts             # Meta Cloud API wrapper: send text, image, interactive (buttons/lists), template messages
│   │   ├── llm.ts                  # OpenRouter API wrapper: sends prompts to Gemini 2.5 Flash, returns structured JSON
│   │   ├── eventParser.ts          # Orchestrates LLM call to parse raw club message into structured event data
│   │   ├── eventSearch.ts          # Builds Supabase queries for event search/filter, optionally uses LLM for natural language
│   │   ├── imageHandler.ts         # Downloads WhatsApp media, compresses with Sharp, uploads to Supabase Storage, returns public URL
│   │   ├── ocr.ts                  # Sends poster image to Gemini with OCR prompt, returns extracted text
│   │   └── scheduler.ts            # node-cron jobs: community digest broadcast (9AM, 6PM), reminder sender, event expiry
│   ├── db/
│   │   └── supabase.ts             # Supabase client initialization + typed query helpers for each table
│   ├── utils/
│   │   ├── dateParser.ts           # Normalizes relative dates ("this Saturday", "tomorrow") to absolute Date objects
│   │   ├── formatter.ts            # Formats event data into WhatsApp-friendly text (bold, emoji, line breaks)
│   │   └── dedup.ts                # Fuzzy matching to detect duplicate event posts (title + date + club similarity)
│   └── types/
│       └── index.ts                # TypeScript interfaces: Event, Club, User, Reminder, WhatsAppMessage, ParsedEvent, etc.
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full schema from Section 4 above
├── .env.example                    # Template for required environment variables
├── package.json
├── tsconfig.json
├── railway.toml                    # Railway deployment config
└── README.md
```

---

## 6. Core Flows (Step by Step)

### 6.1 Club Registration Flow

```
Admin DMs bot: "/register Entrepreneurship Cell"
  → handler: registerClub.ts
  → Check: is this phone already an admin? If yes, reject ("You're already admin of X")
  → Generate 6-char invite code (e.g. "EC3K9R")
  → INSERT into clubs table
  → UPDATE users table: set role='admin', club_id=new_club.id
  → Reply: "✅ *Entrepreneurship Cell* registered!
             Your invite code: `EC3K9R`
             Share this with your publicity person so they can post events.
             They just DM me: /join EC3K9R"
```

### 6.2 Power User Join Flow

```
Publicity person DMs bot: "/join EC3K9R"
  → handler: joinClub.ts
  → Lookup invite_code in clubs table
  → If invalid: "❌ Invalid code. Check with your club admin."
  → If valid:
    → UPDATE users: set role='power_user', club_id=matched_club.id
    → Reply: "✅ You're now a power user for *Entrepreneurship Cell*!
              To post an event, send:
              /post
              [your event message + poster image]"
```

### 6.3 Event Posting Flow (Critical Path)

```
Power User DMs bot:
  Message 1: "/post"
  Message 2: "🚀 Startup Pitch Night 3.0!
              Top 5 student startups pitch to real VCs.
              📅 This Saturday, 7 PM
              📍 LHC 28
              Free pizza! Register: forms.gle/xyz123
              [attached: poster.jpg]"

  → handler: postEvent.ts
  → Step 1: Detect /post command. Set user's conversation state to 'awaiting_event_content'.
            Reply: "📝 Send me the event details — text + poster image. I'll parse it for you."
            (Or if text/image came in the same message as /post, skip this step.)

  → Step 2: Receive the content message.
    → imageHandler.ts: Download image from WhatsApp Media API, compress with Sharp, upload to Supabase Storage. Get public URL.
    → ocr.ts: Send image to Gemini via OpenRouter with OCR prompt. Get extracted text.
    → eventParser.ts: Send to Gemini via OpenRouter with the parsing prompt (see Section 7.1).
      Input: raw message text + OCR text + current date (for relative date resolution) + venue map + category list.
      Output: structured JSON (title, date, time, venue, categories, registration_link, description).
    → dateParser.ts: Resolve any relative dates ("this Saturday") to absolute dates using current date context.
    → dedup.ts: Check for existing events with similar title + date + same club. If match found, warn.

  → Step 3: Send parsed preview as interactive message with buttons.
    → whatsapp.ts: Send interactive message:
      "📋 *Here's what I parsed:*

       🎤 *Startup Pitch Night 3.0*
       📅 Saturday, April 12, 2026 · 7:00 PM
       📍 Lecture Hall Complex, Room 28
       🏷️ Startup · Career · Competition
       📝 Top 5 student startups pitch to real VCs. Free pizza.
       🔗 forms.gle/xyz123

       [Image: poster thumbnail]

       Does this look right?"

      Buttons: [✅ Confirm] [✏️ Edit] [❌ Cancel]

  → Step 4a: User taps ✅ Confirm
    → confirmEvent.ts
    → INSERT into events table with status='confirmed'
    → If is_express=true, broadcast immediately to community
    → Else, queue for next digest
    → Reply: "✅ Event posted! It'll go out in the next community broadcast.
              I'll send you analytics after the event."

  → Step 4b: User taps ✏️ Edit
    → Reply: "Send me the corrected details. You can send just the field to fix, like:
              'Change time to 8 PM' or 'Add tag: workshop'"
    → On receiving edit, re-parse with LLM, show updated preview, loop back to confirm.

  → Step 4c: User taps ❌ Cancel
    → Discard parsed data, clear conversation state.
    → Reply: "Cancelled. Send /post whenever you're ready to try again."
```

### 6.4 Community Broadcast Flow

```
Scheduler (node-cron): Runs at 9:00 AM and 6:00 PM IST daily.
  → scheduler.ts
  → Query events table: status='confirmed', broadcast_sent=FALSE, date >= today
  → Also query: events happening today that haven't been reminded about in broadcast
  → Group events by time-of-day (morning/afternoon/evening) or by category
  → formatter.ts: Format into community digest message:

    "📅 *Events Today & Tomorrow* — April 12-13, 2026

     🔥 *TODAY*

     🎤 *Startup Pitch Night 3.0*
     🕖 7:00 PM · Lecture Hall Complex 28
     🏷️ Startup · Career
     🔗 Register: forms.gle/xyz123
     ─────────────────────

     💻 *Web Dev Bootcamp Day 2*
     🕐 2:00 PM · Bharti Building 101
     🏷️ Tech · Workshop
     ─────────────────────

     📅 *TOMORROW*

     ⚽ *Inter-Hostel Football Finals*
     🕔 5:00 PM · Sports Ground
     🏷️ Sports
     ─────────────────────

     💬 *Want reminders or to search events? DM me →* wa.me/91XXXXXXXXXX"

  → whatsapp.ts: Send to community announcement channel via Meta Cloud API
  → UPDATE events: set broadcast_sent=TRUE for included events
```

### 6.5 User Query Flow

```
Student DMs bot: "any hackathons this week?"
  → router: messageRouter.ts → detect it's a regular user, not a command → route to queryEvents.ts

  → queryEvents.ts:
    → Step 1: Send user's message to Gemini via OpenRouter with query-understanding prompt (Section 7.2).
      Output: { "type": "search", "time_range": "this_week", "categories": ["tech", "competition"], "keywords": ["hackathon"] }

    → Step 2: Build Supabase query:
      SELECT * FROM events
      WHERE status = 'confirmed'
        AND date BETWEEN '2026-04-06' AND '2026-04-12'
        AND (categories && ARRAY['tech','competition'] OR title ILIKE '%hackathon%' OR description ILIKE '%hackathon%')
      ORDER BY date ASC, time ASC

    → Step 3: Format results.
      If 0 results: "No hackathons this week 😕 Want me to notify you when one gets posted? [Yes/No buttons]"
      If 1-3 results: Show each event as a formatted card with [🔔 Remind] [💾 Save] buttons.
      If 4+ results: Send as a WhatsApp List Message (user taps to expand, max 10 items).

    → Step 4: Log view in event_views table.
```

### 6.6 Reminder Flow

```
User taps 🔔 Remind on an event card (or sends "/remind <event_id>")
  → reminders.ts
  → Check: reminder already exists? If yes: "You already have a reminder set for this!"
  → Calculate remind_at: event datetime minus 1 hour (default). If event is within the next hour, remind 15 min before.
  → INSERT into reminders table.
  → Reply: "⏰ Reminder set! I'll ping you 1 hour before *Startup Pitch Night 3.0*."

Scheduler: Runs every minute.
  → Query reminders: remind_at <= NOW() AND sent = FALSE
  → For each:
    → Fetch event details
    → Send WhatsApp template message: "⏰ *Reminder:* Startup Pitch Night 3.0 starts in 1 hour! 📍 LHC 28"
    → UPDATE reminder: sent = TRUE
```

### 6.7 First-Time User Onboarding Flow

```
New user DMs bot with any message.
  → Check users table: does phone exist? No → new user.
  → INSERT into users table with role='user', onboarded=FALSE
  → Send interactive message:

    "👋 Hey! I'm the IITD Events Bot.

     I keep track of all club events happening on campus.
     Ask me things like 'what's happening tonight?' or 'any tech events this week?'

     First, what are you into? (tap all that apply)"

  → Send interactive button group (or a sequence of buttons, since WhatsApp limits to 3 per message):
    Message 1: [💻 Tech] [🎭 Cultural] [⚽ Sports]
    Message 2: [💼 Career] [🚀 Startup] [🎉 Social]
    Message 3: [🔧 Workshop] [📚 Academic] [🏆 Competitions]
    Message 4: [✅ Done]

  → Collect selections. UPDATE users: interests = selected slugs, onboarded = TRUE.
  → Reply: "You're all set! Here's what's coming up that matches your interests:"
    → Immediately run a query for upcoming events matching their interests and show results.
```

---

## 7. LLM Prompts (Gemini 2.5 Flash via OpenRouter)

### 7.1 Event Parsing Prompt

```
System: You are an event parser for IIT Delhi campus events. You receive a WhatsApp publicity message posted by a student club, optionally with OCR text extracted from an accompanying poster image. Your job is to extract structured event information.

Today's date is: {{CURRENT_DATE}} (use this to resolve relative dates like "this Saturday", "tomorrow", "next week")

Known venue shorthands:
{{VENUE_MAP_JSON}}

Available categories (assign 1-3 that best fit):
{{CATEGORIES_JSON}}

Respond with ONLY a JSON object, no markdown, no backticks, no preamble:
{
  "title": "string — event title, cleaned up",
  "description": "string — 1-2 sentence summary of what the event is",
  "date": "YYYY-MM-DD",
  "time": "HH:MM (24hr) or null if not specified",
  "end_time": "HH:MM (24hr) or null",
  "venue": "string — full venue name (use venue map to expand shorthands)",
  "venue_raw": "string — venue exactly as written in the original message",
  "categories": ["array", "of", "category", "slugs"],
  "registration_link": "URL string or null",
  "is_all_day": false,
  "confidence": 0.0-1.0
}

If a field cannot be determined, use null. For date, you MUST provide a value — make your best guess from context and set confidence accordingly.

User:
RAW MESSAGE TEXT:
{{RAW_MESSAGE}}

OCR TEXT FROM POSTER (may be noisy):
{{OCR_TEXT}}
```

### 7.2 Query Understanding Prompt

```
System: You are a query parser for a campus events search system. A student sends a natural language message asking about events. Parse their intent into a structured query.

Today's date is: {{CURRENT_DATE}}

Available categories:
{{CATEGORIES_JSON}}

Respond with ONLY a JSON object:
{
  "type": "search" | "today" | "tomorrow" | "this_week" | "this_weekend",
  "categories": ["array of matching category slugs, empty if not specified"],
  "keywords": ["array of search keywords"],
  "time_range_start": "YYYY-MM-DD or null",
  "time_range_end": "YYYY-MM-DD or null",
  "intent": "brief description of what the user is looking for"
}

Examples:
- "what's happening tonight" → { "type": "today", "categories": [], "keywords": [], "time_range_start": "{{TODAY}}", "time_range_end": "{{TODAY}}", "intent": "all events today" }
- "any coding competitions?" → { "type": "search", "categories": ["tech","competition"], "keywords": ["coding","competition"], "time_range_start": null, "time_range_end": null, "intent": "coding competitions" }
- "startup events this week" → { "type": "this_week", "categories": ["startup"], "keywords": ["startup"], "time_range_start": "{{WEEK_START}}", "time_range_end": "{{WEEK_END}}", "intent": "startup events this week" }

User: {{USER_MESSAGE}}
```

### 7.3 OCR Prompt

```
System: Extract all readable text from this event poster image. The poster is for a college campus event at IIT Delhi. Focus on: event title, date, time, venue, speaker names, registration links, QR code context, sponsor names. Return raw extracted text, preserve layout loosely. Do not interpret or summarize — just extract text.

User: [image attachment]
```

---

## 8. API & Webhook Specification

### 8.1 Webhook Endpoint

```
GET  /webhook  — Meta verification (hub.mode, hub.verify_token, hub.challenge)
POST /webhook  — Incoming messages from WhatsApp
```

### 8.2 Webhook POST Payload Processing

Every incoming WhatsApp message hits POST /webhook. The handler (`webhook/handler.ts`):

1. Validate `X-Hub-Signature-256` header using app secret (`signature.ts`)
2. Extract message data: sender phone, message type (text/image/interactive_reply/button_reply), message body, media ID (if image)
3. Upsert user in `users` table (create if first message)
4. Pass to `messageRouter.ts`

### 8.3 Message Router Logic

```typescript
// messageRouter.ts — pseudocode
async function routeMessage(user: User, message: WhatsAppMessage) {

  // Check if user has pending conversation state (e.g., awaiting event content after /post)
  const state = await getConversationState(user.id);
  if (state) {
    return handleStatefulMessage(user, message, state);
  }

  // New user — not onboarded
  if (!user.onboarded) {
    return handleOnboarding(user, message);
  }

  // Command-based routing
  const text = message.text?.trim().toLowerCase();

  if (text?.startsWith('/register')) return handleRegisterClub(user, message);
  if (text?.startsWith('/join'))     return handleJoinClub(user, message);
  if (text?.startsWith('/post'))     return handlePostEvent(user, message);
  if (text?.startsWith('/help'))     return handleHelp(user);
  if (text?.startsWith('/today'))    return handleQuery(user, { type: 'today' });
  if (text?.startsWith('/tomorrow')) return handleQuery(user, { type: 'tomorrow' });
  if (text?.startsWith('/week'))     return handleQuery(user, { type: 'this_week' });
  if (text?.startsWith('/saved'))    return handleSavedEvents(user);
  if (text?.startsWith('/subscribe'))   return handleSubscribe(user, message);
  if (text?.startsWith('/unsubscribe')) return handleUnsubscribe(user, message);
  if (text?.startsWith('/mystats'))     return handleClubStats(user); // power user / admin only

  // Interactive reply handling (button taps, list selections)
  if (message.type === 'interactive') {
    return handleInteractiveReply(user, message);
  }

  // Fallback: treat as natural language query
  return handleNaturalLanguageQuery(user, message);
}
```

### 8.4 Conversation State Management

Some flows (like /post) are multi-step. Use a simple in-memory store (Map) or a Supabase table:

```sql
CREATE TABLE conversation_states (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  state TEXT NOT NULL, -- e.g. 'awaiting_event_content', 'awaiting_confirmation', 'awaiting_edit', 'onboarding_interests'
  data JSONB DEFAULT '{}', -- temp data for the flow (e.g. parsed event awaiting confirmation)
  expires_at TIMESTAMPTZ NOT NULL, -- auto-clear after 30 minutes of inactivity
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. WhatsApp Message Templates

These must be pre-approved in Meta Business Manager before use. Submit these:

### 9.1 Reminder Template
```
Name: event_reminder
Language: en
Category: UTILITY
Body: "⏰ Reminder: {{1}} starts in {{2}}! 📍 {{3}}"
  {{1}} = event title
  {{2}} = time until event (e.g. "1 hour", "15 minutes")
  {{3}} = venue
```

### 9.2 Daily Digest Template
```
Name: daily_digest
Language: en
Category: UTILITY
Body: "📅 Your personalized events for today:\n\n{{1}}\n\nReply to search for more events!"
  {{1}} = formatted event list (max 1024 chars)
```

### 9.3 Post-Event Analytics Template
```
Name: event_analytics
Language: en
Category: UTILITY
Body: "📊 Analytics for your event *{{1}}*:\n👀 {{2}} views\n💾 {{3}} saves\n🔔 {{4}} reminders set\n\nKeep posting! Your next event will reach even more students."
  {{1}} = event title
  {{2}} = view count
  {{3}} = save count
  {{4}} = reminder count
```

---

## 10. Environment Variables

```env
# Meta WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=        # From Meta Business Manager
WHATSAPP_BUSINESS_ACCOUNT_ID=    # From Meta Business Manager
WHATSAPP_ACCESS_TOKEN=           # Permanent system user token
WHATSAPP_VERIFY_TOKEN=           # Custom string for webhook verification
WHATSAPP_APP_SECRET=             # For signature validation
WHATSAPP_COMMUNITY_GROUP_ID=     # The community announcement group JID

# OpenRouter
OPENROUTER_API_KEY=              # From openrouter.ai
OPENROUTER_MODEL=google/gemini-2.5-flash  # Model identifier

# Supabase
SUPABASE_URL=                    # Project URL
SUPABASE_ANON_KEY=               # Anon/public key (for storage)
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (for DB operations, server-side only)

# App Config
PORT=3000
NODE_ENV=production
TIMEZONE=Asia/Kolkata
GOD_PHONE=+91XXXXXXXXXX         # Developer's phone number for god-mode access
```

---

## 11. Key Implementation Details

### 11.1 WhatsApp Interactive Messages

Use these Meta Cloud API message types for rich UX:

**Button Messages** (max 3 buttons):
```json
{
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Event details here..." },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "confirm_evt_123", "title": "✅ Confirm" }},
        { "type": "reply", "reply": { "id": "edit_evt_123", "title": "✏️ Edit" }},
        { "type": "reply", "reply": { "id": "cancel_evt_123", "title": "❌ Cancel" }}
      ]
    }
  }
}
```

**List Messages** (up to 10 items, ideal for search results):
```json
{
  "type": "interactive",
  "interactive": {
    "type": "list",
    "body": { "text": "Here are the events I found:" },
    "action": {
      "button": "View Events",
      "sections": [{
        "title": "Today",
        "rows": [
          { "id": "evt_123", "title": "Startup Pitch Night", "description": "7 PM · LHC 28" },
          { "id": "evt_456", "title": "Web Dev Bootcamp", "description": "2 PM · Bharti 101" }
        ]
      }]
    }
  }
}
```

When a user taps a list item or button, the webhook receives the `id` you set. Route these in `handleInteractiveReply()` — parse the ID prefix to determine action (e.g., `confirm_evt_`, `remind_evt_`, `save_evt_`, `view_evt_`).

### 11.2 Image Handling Pipeline

```
WhatsApp sends media_id in message payload
  → GET https://graph.facebook.com/v21.0/{media_id} with access token → get download URL
  → GET download URL → binary image data
  → Sharp: resize to max 1200px width, convert to JPEG, quality 80
  → Upload to Supabase Storage bucket "posters" with path: {club_slug}/{event_id}.jpg
  → Get public URL from Supabase
  → Store URL in events.poster_url
```

### 11.3 Deduplication Logic

Before confirming an event, check for duplicates:

```typescript
// dedup.ts
async function findDuplicates(parsedEvent: ParsedEvent, clubId: string): Promise<Event[]> {
  // Query events from same club within +/- 1 day of parsed date
  const candidates = await supabase
    .from('events')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', 'confirmed')
    .gte('date', subtractDays(parsedEvent.date, 1))
    .lte('date', addDays(parsedEvent.date, 1));

  // Fuzzy match on title (using simple Levenshtein distance or token overlap)
  return candidates.filter(evt =>
    titleSimilarity(evt.title, parsedEvent.title) > 0.7
  );
}
```

If duplicate found, warn the Power User: "⚠️ This looks similar to an event you already posted: *[title]* on *[date]*. Post anyway? [Yes/No]"

### 11.4 Event Expiry

Scheduler job runs daily at midnight:
```sql
UPDATE events SET status = 'expired' WHERE date < CURRENT_DATE AND status = 'confirmed';
```

### 11.5 Rate Limiting

- Power Users: max 5 events per day per club (prevent spam)
- Express posts: max 1 per club per week
- Users: max 60 messages per hour (prevent abuse)
- Track in-memory with a simple Map + TTL, no Redis needed at this scale

---

## 12. Broadcast Strategy

### 12.1 Daily Digest Schedule (IST)
- **9:00 AM**: Morning digest — events happening today + newly posted events for this week
- **6:00 PM**: Evening digest — events happening tonight + tomorrow's highlights

### 12.2 Express Broadcast
- Power User marks event as "urgent/today" during posting
- If approved (within rate limit), event is broadcast to community immediately as a standalone message
- Format is the same as a single event card

### 12.3 Community Message Ordering
Within a digest, events are ordered:
1. Happening soonest first
2. Within same time, alphabetical by title
3. If > 10 events, only show top 10 and add: "10 more events — DM me to see all →"

---

## 13. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| LLM fails to parse event | Retry once. If still fails, ask Power User to simplify message. Store raw message for manual review. |
| Image download fails | Post event without image. Notify Power User: "Couldn't process your image. Event posted text-only." |
| User sends random gibberish | LLM query parser returns low confidence → reply: "I didn't catch that. Try 'what's happening today?' or type /help" |
| Duplicate /register for same club name | Reject: "A club with this name already exists. Contact the admin or use a different name." |
| Power User tries /post without being linked to a club | "You need to join a club first. Ask your club admin for an invite code and send /join <code>" |
| Event date is in the past | Reject at confirmation: "This event's date (April 5) has already passed. Did you mean a different date?" |
| WhatsApp template not approved yet | Fall back to regular text message (only works within 24hr session window). Log warning. |
| Supabase downtime | Return friendly error: "I'm having trouble right now. Try again in a few minutes." Log to console for alerting. |
| User sends /post but is a regular user | "Only club publicity members can post events. Ask your club admin to add you, or just search for events!" |

---

## 14. MVP Scope vs Future

### MVP (Build First)
- [ ] Webhook setup + signature validation
- [ ] User creation on first message
- [ ] /register and /join flows
- [ ] /post → LLM parsing → preview → confirm → store in DB
- [ ] Image download + Supabase Storage upload
- [ ] /today, /tomorrow, /week queries
- [ ] Natural language query via LLM
- [ ] Community digest broadcast (2x daily via cron)
- [ ] Event formatting with poster image in responses
- [ ] /help command
- [ ] Basic error handling

### Phase 2
- [ ] Reminders (template messages + scheduler)
- [ ] Save/bookmark events
- [ ] User onboarding with interest selection
- [ ] Interactive messages (buttons, lists) for all responses
- [ ] Deduplication warnings
- [ ] OCR on poster images for better parsing

### Phase 3
- [ ] /subscribe category digests
- [ ] Post-event analytics for clubs
- [ ] Express/urgent broadcast
- [ ] Natural language event editing ("change time to 8 PM")
- [ ] Rate limiting
- [ ] Event expiry automation
- [ ] Venue normalization

### Phase 4 (Growth)
- [ ] Web dashboard for event browsing
- [ ] Club analytics dashboard
- [ ] Multi-campus expansion
- [ ] Sponsored/promoted events
- [ ] Student interest graph for smarter recommendations

---

## 15. Key Dependencies (package.json)

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "axios": "^1.7.0",
    "@supabase/supabase-js": "^2.45.0",
    "sharp": "^0.33.0",
    "node-cron": "^3.0.0",
    "dotenv": "^16.4.0",
    "fastest-levenshtein": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/express": "^4.17.0",
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.0",
    "ts-node": "^10.9.0",
    "tsx": "^4.16.0",
    "nodemon": "^3.1.0"
  }
}
```

---

## 16. Deployment (Railway)

### railway.toml
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 5
```

### Health check endpoint
```typescript
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
```

### Deployment flow
1. Push to GitHub main branch
2. Railway auto-deploys
3. Set all env vars in Railway dashboard
4. Railway provides a public URL → set this as the webhook URL in Meta App Dashboard

---

## 17. Testing Strategy

### Manual Testing Checklist (MVP)
1. Send a message from an unknown number → user created, help/onboarding shown
2. /register TestClub → club created, invite code received
3. /join <code> from a different number → linked as power user
4. /post + sample event message + image → parsed preview shown with correct fields
5. Tap Confirm → event stored in Supabase, status=confirmed
6. /today from a regular user → event shows up if date matches
7. Natural language query "any events tonight?" → correct results
8. Wait for 9 AM cron → community digest sent with confirmed events
9. Send same event again → dedup warning fires
10. /post with past date → rejected with helpful error
```