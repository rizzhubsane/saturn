import { completeJSON } from './llm.js';
import { queryEvents as dbQueryEvents, getRecentMessages } from '../db/supabase.js';
import { getTodayIST, getDateRange, addCalendarDays } from '../utils/dateParser.js';
import type { Event, EventFilters, ParsedQuery } from '../types/index.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const QUERY_SYSTEM_PROMPT = `You are Saturn, the campus assistant for IIT Delhi. A student sends a natural language message asking about events, clubs, or just talking to you. First, establish their core intent.

Today's date is: {{CURRENT_DATE}}

Available categories:
{{CATEGORIES_JSON}}

Respond with ONLY a JSON object:
{
  "intent_domain": "events" | "clubs" | "general",
  "direct_reply": "if general, write your warm, helpful response here. null otherwise",
  "type": "search" | "today" | "tomorrow" | "this_week" | "this_weekend",
  "categories": ["array of matching category slugs, empty if not specified"],
  "keywords": ["array of search keywords"],
  "time_range_start": "YYYY-MM-DD or null",
  "time_range_end": "YYYY-MM-DD or null",
  "intent": "brief description"
}

HINTS:
- Saturn only sends WhatsApp messages when the user has messaged first (reply-only). Never promise unprompted DMs, push notifications, scheduled WhatsApp pings, or that Saturn will text them later before an event.
- "Reminders" in Saturn mean: the user saves an event and receives add-to-calendar links (Google / Apple .ics) in the chat — not separate WhatsApp reminder messages from the bot. Describe it that way if asked.
- Do not tell users Saturn will "ping", "notify", or "remind" them on WhatsApp before an event; calendar apps handle time-based reminders after they add the event.
- For queries asking "is there a X club" or "what clubs exist", set intent_domain to "clubs". Extract category if inferable.
- For queries asking about an event, set intent_domain to "events". Map "hardware", "motorsports", etc. to "engineering", and "mental health", "charity" to "wellness".
- CRITICAL: If the user combines a topic AND a time window (e.g. "sports events this week", "tech talks tomorrow", "cultural events today"), you MUST set intent_domain to "events", include the right category slugs in "categories", set "type" to today|tomorrow|this_week|this_weekend matching their window, and set time_range_start/time_range_end to match that window. Do NOT leave type as "search" for those.
- "This week" means type "this_week". "Tonight" / "today" means type "today". "Tomorrow" means type "tomorrow".
- For generic conversation ("who are you", "hi", "how does this work"), set intent_domain to "general", set type to "search", and write a friendly response in direct_reply.`;

/** Rule-based fixes when the model misses time window + category together */
function enrichParsedQuery(naturalQuery: string, parsed: ParsedQuery): ParsedQuery {
  const lower = naturalQuery.toLowerCase().trim();
  if (parsed.intent_domain !== 'events') return parsed;

  const out: ParsedQuery = { ...parsed, categories: [...(parsed.categories || [])] };

  if (/\bthis\s+week\b/.test(lower) || /\bthisweek\b/.test(lower)) {
    const r = getDateRange('this_week');
    out.time_range_start = r.start;
    out.time_range_end = r.end;
    out.type = 'this_week';
  } else if (/\bnext\s+week\b/.test(lower)) {
    const t = getTodayIST();
    out.time_range_start = addCalendarDays(t, 7);
    out.time_range_end = addCalendarDays(t, 13);
    out.type = 'search';
  } else if (/\btomorrow\b/.test(lower) && !/\btoday\b/.test(lower) && !/\btonight\b/.test(lower)) {
    const r = getDateRange('tomorrow');
    out.time_range_start = r.start;
    out.time_range_end = r.end;
    out.type = 'tomorrow';
  } else if (/\b(today|tonight)\b/.test(lower) && !/\btomorrow\b/.test(lower)) {
    const r = getDateRange('today');
    out.time_range_start = r.start;
    out.time_range_end = r.end;
    out.type = 'today';
  } else if (/\bweekend\b/.test(lower) && !/\bthis\s+week\b/.test(lower)) {
    const r = getDateRange('this_weekend');
    out.time_range_start = r.start;
    out.time_range_end = r.end;
    out.type = 'this_weekend';
  }

  if (/\b(sport|sports|football|cricket|basketball|badminton|athletics|khel)\b/i.test(lower)) {
    if (!out.categories.includes('sports')) out.categories.push('sports');
  }

  return out;
}

/**
 * Parse a natural language query using LLM, then search the database.
 */
export async function searchEvents(naturalQuery: string, userId?: string): Promise<{
  domain: 'events' | 'clubs' | 'general';
  events?: Event[];
  intent: string;
  direct_reply?: string;
  categories?: string[];
}> {
  const today = getTodayIST();

  const systemPrompt = QUERY_SYSTEM_PROMPT
    .replace('{{CURRENT_DATE}}', today)
    .replace('{{CATEGORIES_JSON}}', JSON.stringify(categoriesConfig.categories.map(c => ({ slug: c.slug, label: c.label }))));

  // Build user prompt with conversation history for context
  let userPrompt = naturalQuery;
  if (userId) {
    try {
      const history = await getRecentMessages(userId, 4);
      if (history.length > 0) {
        const historyStr = history
          .map(m => `${m.direction === 'in' ? 'User' : 'Bot'}: ${m.content.substring(0, 200)}`)
          .join('\n');
        userPrompt = `RECENT CONVERSATION (for context):\n${historyStr}\n\nCURRENT MESSAGE:\n${naturalQuery}`;
      }
    } catch { /* proceed without history */ }
  }

  const parsed = await completeJSON<ParsedQuery>(systemPrompt, userPrompt, {
    temperature: 0.2,
  });

  const enriched =
    parsed.intent_domain === 'events' ? enrichParsedQuery(naturalQuery, parsed) : parsed;

  if (enriched.intent_domain === 'general') {
    return {
      domain: 'general',
      intent: enriched.intent,
      direct_reply: enriched.direct_reply
    };
  }

  if (enriched.intent_domain === 'clubs') {
    return {
      domain: 'clubs',
      intent: enriched.intent,
      categories: enriched.categories
    };
  }

  // Domain must be events. Build filters from parsed query
  const filters: EventFilters = {
    status: 'confirmed',
    limit: 10,
  };

  // Set date range
  if (enriched.time_range_start) {
    filters.dateStart = enriched.time_range_start;
  } else if (['today', 'tomorrow', 'this_week', 'this_weekend'].includes(enriched.type)) {
    const range = getDateRange(enriched.type as 'today' | 'tomorrow' | 'this_week' | 'this_weekend');
    filters.dateStart = range.start;
    filters.dateEnd = range.end;
  } else {
    // Default: from today onwards
    filters.dateStart = today;
  }

  if (enriched.time_range_end) {
    filters.dateEnd = enriched.time_range_end;
  }

  if (enriched.categories && enriched.categories.length > 0) {
    filters.categories = enriched.categories;
  }

  if (enriched.keywords && enriched.keywords.length > 0) {
    filters.keywords = enriched.keywords;
  }

  const events = await dbQueryEvents(filters);
  return { domain: 'events', events, intent: enriched.intent };
}

/**
 * Search by explicit command (no LLM needed).
 */
export async function searchByCommand(
  type: 'today' | 'tomorrow' | 'this_week' | 'this_weekend',
  additionalFilters: Partial<EventFilters> = {}
): Promise<Event[]> {
  const range = getDateRange(type);
  const filters: EventFilters = {
    dateStart: range.start,
    dateEnd: range.end,
    status: 'confirmed',
    limit: 15,
    ...additionalFilters,
  };
  return dbQueryEvents(filters);
}

/**
 * Search by keyword.
 */
export async function searchByKeyword(keyword: string): Promise<Event[]> {
  const today = getTodayIST();
  return dbQueryEvents({
    dateStart: today,
    keywords: keyword.split(/\s+/),
    status: 'confirmed',
    limit: 15,
  });
}

/**
 * Search by category.
 */
export async function searchByCategory(category: string): Promise<Event[]> {
  const today = getTodayIST();
  return dbQueryEvents({
    dateStart: today,
    categories: [category],
    status: 'confirmed',
    limit: 15,
  });
}
