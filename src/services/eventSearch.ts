import { completeJSON } from './llm.js';
import { queryEvents as dbQueryEvents } from '../db/supabase.js';
import { getTodayIST, getDateRange } from '../utils/dateParser.js';
import type { Event, EventFilters, ParsedQuery } from '../types/index.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const QUERY_SYSTEM_PROMPT = `You are a query parser for a campus events search system. A student sends a natural language message asking about events. Parse their intent into a structured query.

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
}`;

/**
 * Parse a natural language query using LLM, then search the database.
 */
export async function searchEvents(naturalQuery: string): Promise<{ events: Event[]; intent: string }> {
  const today = getTodayIST();

  const systemPrompt = QUERY_SYSTEM_PROMPT
    .replace('{{CURRENT_DATE}}', today)
    .replace('{{CATEGORIES_JSON}}', JSON.stringify(categoriesConfig.categories.map(c => ({ slug: c.slug, label: c.label }))));

  const parsed = await completeJSON<ParsedQuery>(systemPrompt, naturalQuery, {
    temperature: 0.2,
  });

  // Build filters from parsed query
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

  if (parsed.categories.length > 0) {
    filters.categories = parsed.categories;
  }

  if (parsed.keywords.length > 0) {
    filters.keywords = parsed.keywords;
  }

  const events = await dbQueryEvents(filters);
  return { events, intent: parsed.intent };
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
