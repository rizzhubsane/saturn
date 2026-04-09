import categoriesConfig from '../config/categories.json' with { type: 'json' };

/**
 * Normalize WhatsApp text so slash commands match reliably.
 * Some clients send fullwidth solidus (U+FF0F) instead of ASCII / (U+002F).
 */
export function normalizeCommandBody(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\uFF0F/g, '/')
    .trim();
}

/** Known /command roots — used to escape conversation state without eating event text like "/hackathon title..." */
const COMMAND_HEADS = new Set<string>([
  'help', 'menu', 'start', 'post', 'today', 'tomorrow', 'week', 'thisweek', 'weekend',
  'search', 'clubs', 'club', 'saved', 'digest', 'feedback', 'register', 'join', 'myevents',
  'clubinfo', 'editclub', 'mysubs', 'subscribe', 'unsubscribe', 'remind', 'save', 'unsave',
  'adduser', 'removeuser', 'orginfo', 'analytics', 'addorg', 'promote', 'broadcast', 'stats',
  'purge', 'digesttest', 'cancel',
  ...categoriesConfig.categories.map(c => c.slug),
]);

/**
 * True if this message should leave a multi-step flow and run normal command routing instead.
 */
export function shouldBreakOutToCommandRouter(text: string): boolean {
  const n = normalizeCommandBody(text);
  const m = n.match(/^\/([a-z0-9_-]+)/i);
  if (!m) return false;
  return COMMAND_HEADS.has(m[1].toLowerCase());
}
