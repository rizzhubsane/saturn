# Saturn — User Guide

Saturn is a WhatsApp assistant that helps you discover campus club events at IIT Delhi. You can type **commands** (starting with `/`) or ask questions in **plain English**.

Send **`/help`**, **`/menu`**, or **`/start`** anytime for a short in-chat cheat sheet tailored to your account type.

---

## First time here

When you first message Saturn, it runs a quick **interest setup** in a few steps (shown as **1/3**, **2/3**, **3/3**). Tap categories that match you, or finish when you are done. You can still use **`/register`**, **`/join`**, **`/help`**, or **`/feedback`** before you finish onboarding.

---

## Finding events

### Ask naturally

Examples:

- “What’s happening today?”
- “Any hackathons this week?”
- “Show me cultural events tonight.”
- “Is there a coding club?”

Saturn tries to understand intent and reply with relevant events or club info.

### Quick commands

| Command | What it does |
|--------|----------------|
| `/today` | Events today |
| `/tomorrow` | Events tomorrow |
| `/week` or `/thisweek` | This week |
| `/weekend` | This weekend |
| `/search <keyword>` | Search titles/descriptions (e.g. `/search hackathon`) |

### Category shortcuts

Use **`/<slug>`** to filter by category (same slugs as subscriptions):

| Command | Focus |
|---------|--------|
| `/tech` | Tech & Coding |
| `/engineering` | Science & Engineering |
| `/cultural` | Cultural & Performing Arts |
| `/sports` | Sports & Fitness |
| `/gaming` | E-Sports & Gaming |
| `/career` | Career & Placement |
| `/finance` | Finance & Economics |
| `/startup` | Startup & Business |
| `/academic` | Academic & Research |
| `/design` | Arts, Design & Media |
| `/literature` | Literature & Debating |
| `/wellness` | Wellness & Social Impact |
| `/social` | Social & Chill |
| `/food` | Food & Festivals |
| `/workshop` | Workshops |
| `/talk` | Talks & Lectures |
| `/competition` | Competitions |

---

## Clubs

| Command | What it does |
|--------|----------------|
| `/clubs` | Browse all active clubs |
| `/clubs <category>` | Clubs filtered by category slug (e.g. `/clubs tech`) |
| `/club <name>` | Profile and context for one club (partial name match) |

---

## Your lists, reminders, and alerts

| Command | What it does |
|--------|----------------|
| `/saved` | Events you bookmarked |
| `/save <event_id>` | Bookmark an event (use the id from event details) |
| `/unsave <event_id>` | Remove a bookmark |
| `/remind <event_id>` | Set a reminder before the event |
| `/subscribe <category>` | Get notified when new events appear in that category |
| `/unsubscribe <category>` | Stop those notifications |
| `/mysubs` | List your category subscriptions |

---

## Personal daily digest

| Command | What it does |
|--------|----------------|
| `/digest` | Set what kinds of events you want in **your** daily digest (by category). You can list interests in one message (e.g. `tech, startup`) or say **`all`** for everything. Saturn sends a **today** snapshot after saving preferences. |

Morning and evening digests use your saved preferences so you mostly see matching categories.

---

## Feedback

| Command | What it does |
|--------|----------------|
| `/feedback` | Start feedback mode: send a follow-up message with your thoughts. |
| `/feedback <message>` | Send feedback in one step. |

Saturn saves your note together with a short **recent chat context** (about the last few messages) so maintainers can see what you were doing when you wrote in. Use **`/cancel`** to exit feedback mode without sending.

---

## Club teams: posting and profile

If your account is linked as a **power user** or **admin** for a club:

| Command | What it does |
|--------|----------------|
| `/post` | Start posting an event (text and/or poster image) |
| `/myevents` | Events you posted |
| `/clubinfo` | Your club’s profile and engagement stats |
| `/editclub` | Update club details (guided flow) |

**Admins** additionally have team commands such as **`/adduser`**, **`/removeuser`**, **`/orginfo`**, and **`/analytics`** (see `/help` on your account).

---

## Registering a club or joining a team

| Command | What it does |
|--------|----------------|
| `/register` | Start club registration (for new clubs) |
| `/register …` | Follow the bot’s prompts |
| `/join <invite_code>` | Join a club’s team with the invite code your admin shared |

---

## Tips while chatting

1. **Numbers:** After Saturn shows a numbered event list, reply with **`1`**, **`2`**, etc. to open details (and RSVP options where available).
2. **Buttons:** Use quick-reply buttons when shown; they are often faster than typing.
3. **Discovery tips:** Many replies end with a short **tip** line to help you find features—wording changes so it stays useful, not repetitive.

---

## “God” (system operators only)

These commands are **restricted** to the configured system operator account:

- `/stats` — Overall usage stats  
- `/broadcast <message>` — Announcement to users  
- `/digesttest` — Preview community digest format  
- `/purge` — Maintenance (e.g. expiring old events)  
- `/addorg`, `/promote`, … — Org and access management  

Regular users will see “restricted” if they try these.

---

## Something went wrong?

- Send **`/help`** again.
- Try rephrasing in plain English or use a **`/`** command from this guide.
- Use **`/feedback`** to report bugs or confusing answers.

---

*This guide matches the Saturn bot behavior in this repository. Commands may evolve; `/help` in WhatsApp is always the live summary for your role.*
