import { completeJSON } from './llm.js';
import { queryEvents as dbQueryEvents, getRecentMessages } from '../db/supabase.js';
import { getTodayIST, getDateRange } from '../utils/dateParser.js';
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
- For queries asking "is there a X club" or "what clubs exist", set intent_domain to "clubs". Extract category if inferable.
- For queries asking about an event, set intent_domain to "events". Map "hardware", "motorsports", etc. to "engineering", and "mental health", "charity" to "wellness".
- For generic conversation ("who are you", "hi", "how does this work"), set intent_domain to "general", set type to "search", and write a friendly response in direct_reply.`;

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

  if (parsed.intent_domain === 'general') {
    return {
      domain: 'general',
      intent: parsed.intent,
      direct_reply: parsed.direct_reply
    };
  }

  if (parsed.intent_domain === 'clubs') {
    return {
      domain: 'clubs',
      intent: parsed.intent,
      categories: parsed.categories
    };
  }

  // Domain must be events. Build filters from parsed query
  const filters: EventFilters = {
    status: 'confirmed',
    limit: 10,
  };

  // Set date range
  if (parsed.time_range_start) {
    filters.dateStart = parsed.time_range_start;
  } else if (['today', 'tomorrow', 'this_week', 'this_weekend'].includes(parsed.type)) {
    const range = getDateRange(parsed.type as any);
    filters.dateStart = range.start;
    filters.dateEnd = range.end;
  } else {
    // Default: from today onwards
    filters.dateStart = today;
  }

  if (parsed.time_range_end) {
    filters.dateEnd = parsed.time_range_end;
  }

  if (parsed.categories && parsed.categories.length > 0) {
    filters.categories = parsed.categories;
  }

  if (parsed.keywords && parsed.keywords.length > 0) {
    filters.keywords = parsed.keywords;
  }

  const events = await dbQueryEvents(filters);
  return { domain: 'events', events, intent: parsed.intent };
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
