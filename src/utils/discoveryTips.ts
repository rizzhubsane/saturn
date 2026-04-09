const recentTipsByPhone = new Map<string, string[]>();
const MAX_RECENT_TIPS = 4;

const tipCatalog = {
  digest: [
    'Tip: Use `/digest` anytime to change your daily categories in seconds.',
    'Tip: If your interests changed this week, rerun `/digest` to refresh your feed.',
    'Tip: Daily digest can stay focused, like only tech/startup/career updates.',
  ],
  search: [
    'Tip: Try `/search hackathon` to jump straight to specific events.',
    'Tip: Use `/today`, `/tomorrow`, and `/weekend` for quick planning.',
    'Tip: Ask naturally like "any coding events tonight?" and Saturn will parse it.',
  ],
  clubs: [
    'Tip: Use `/clubs` to discover active communities, then `/club <name>` for details.',
    'Tip: Club pages show context before you commit to an event.',
    'Tip: Following clubs helps you discover events earlier in the cycle.',
  ],
  saved: [
    'Tip: Use `/save <event_id>` to bookmark events you might join later.',
    'Tip: Open `/saved` before the weekend to shortlist what to attend.',
    'Tip: Saved events + reminders are the fastest way to avoid missing deadlines.',
  ],
  reminders: [
    'Tip: Use `/remind <event_id>` so Saturn pings you before kickoff.',
    'Tip: RSVP reminders work best when you set them right after saving an event.',
    'Tip: Reminder nudges are useful for high-signal talks and competitions.',
  ],
  posting: [
    'Tip: While posting, include clear date/time/venue to improve event visibility.',
    'Tip: Better highlights in your event card usually increase reminder conversions.',
    'Tip: Use `/myevents` after posting to quickly verify what users will see.',
  ],
  general: [
    'Tip: Start with `/help` to unlock shortcuts you may not be using yet.',
    'Tip: You can mix commands and natural language; Saturn supports both.',
    'Tip: Ask for "events this week in tech" to get focused results fast.',
  ],
} as const;

type TipCategory = keyof typeof tipCatalog;

export function buildMessageWithTip(phone: string, text: string): string {
  const trimmed = text.trim();
  const tip = pickTip(phone, inferCategory(trimmed));
  return `${trimmed}\n\n${tip}`;
}

function inferCategory(text: string): TipCategory {
  const lower = text.toLowerCase();
  if (lower.includes('digest') || lower.includes('daily')) return 'digest';
  if (lower.includes('/clubs') || lower.includes('club')) return 'clubs';
  if (lower.includes('/saved') || lower.includes('bookmark') || lower.includes('saved')) return 'saved';
  if (lower.includes('/remind') || lower.includes('reminder') || lower.includes('rsvp')) return 'reminders';
  if (lower.includes('/post') || lower.includes('publish') || lower.includes('posted')) return 'posting';
  if (lower.includes('/search') || lower.includes('/today') || lower.includes('/week') || lower.includes('events')) return 'search';
  return 'general';
}

function pickTip(phone: string, category: TipCategory): string {
  const pool = [...tipCatalog[category], ...tipCatalog.general];
  const recent = recentTipsByPhone.get(phone) || [];
  const candidates = pool.filter(t => !recent.includes(t));
  const selectionPool = candidates.length > 0 ? candidates : pool;
  const chosen = selectionPool[Math.floor(Math.random() * selectionPool.length)];

  const updatedRecent = [...recent, chosen].slice(-MAX_RECENT_TIPS);
  recentTipsByPhone.set(phone, updatedRecent);
  return chosen;
}
