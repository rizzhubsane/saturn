const recentTipsByPhone = new Map<string, string[]>();
const MAX_RECENT_TIPS = 4;

const tipCatalog = {
  digest: [
    'Tip: Use `/digest` to set category filters — then ask Saturn anytime for today\'s events.',
    'Tip: `/digest` saves preferences for smarter answers when you message; Saturn won\'t DM you first.',
    'Tip: Combine `/digest` with natural questions like "what\'s on today in tech?"',
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
    'Tip: Tap *Save & calendar* on a card to get add-to-calendar links — your phone reminds you.',
  ],
  reminders: [
    'Tip: `/remind` saves the event and sends calendar links — not WhatsApp pings from Saturn.',
    'Tip: After you pick iOS or Android, add the event so your calendar app notifies you.',
    'Tip: Best flow: find an event → Save & calendar → open the link on your phone.',
  ],
  posting: [
    'Tip: While posting, include clear date/time/venue to improve event visibility.',
    'Tip: Better highlights in your event card usually increase reminder conversions.',
    'Tip: Use `/myevents` after posting to quickly verify what users will see.',
  ],
  feedback: [
    'Tip: Use `/feedback` anytime something feels confusing—we attach recent chat for context.',
    'Tip: After a bad answer, `/feedback` helps us see what went wrong in your thread.',
    'Tip: Short feedback with `/feedback` is enough; you can also add detail on the next line.',
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
  if (lower.includes('/feedback') || lower.includes('feedback')) return 'feedback';
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
