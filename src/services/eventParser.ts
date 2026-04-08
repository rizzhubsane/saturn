import { completeJSON } from './llm.js';
import { getTodayIST } from '../utils/dateParser.js';
import type { ParsedEvent } from '../types/index.js';
import venueMap from '../config/venues.json' with { type: "json" };
import categoriesConfig from '../config/categories.json' with { type: "json" };

const PARSE_SYSTEM_PROMPT = `You are an event parser for IIT Delhi campus events. You receive a WhatsApp publicity message posted by a student club, optionally with OCR text extracted from an accompanying poster image. Your job is to extract structured event information.

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

If a field cannot be determined, use null. For date, you MUST provide a value.
HINTS FOR CATEGORIES:
- Blood donation, charity, welfare, mental health -> "wellness"
- Stand-up comedy, movie nights, casual meetups -> "cultural" or "social"
- Resume building, placement talks -> "career"
- Hackathons -> "tech" and "competition"`;

/**
 * Parse a raw club publicity message into structured event data.
 */
export async function parseEventMessage(
  rawMessage: string,
  ocrText: string = ''
): Promise<ParsedEvent> {
  const today = getTodayIST();

  // Build the system prompt with injected context
  const systemPrompt = PARSE_SYSTEM_PROMPT
    .replace('{{CURRENT_DATE}}', today)
    .replace('{{VENUE_MAP_JSON}}', JSON.stringify(venueMap))
    .replace('{{CATEGORIES_JSON}}', JSON.stringify(categoriesConfig.categories.map(c => ({ slug: c.slug, label: c.label }))));

  // Build user prompt
  let userPrompt = `RAW MESSAGE TEXT:\n${rawMessage}`;
  if (ocrText) {
    userPrompt += `\n\nOCR TEXT FROM POSTER (may be noisy):\n${ocrText}`;
  }

  const parsed = await completeJSON<ParsedEvent>(systemPrompt, userPrompt, {
    temperature: 0.2,
  });

  // Validate required fields
  if (!parsed.title) {
    throw new Error('Could not extract event title from the message');
  }
  if (!parsed.date) {
    throw new Error('Could not determine event date from the message');
  }

  // Normalize categories to valid slugs
  const validSlugs = new Set(categoriesConfig.categories.map(c => c.slug));
  parsed.categories = (parsed.categories || []).filter(c => validSlugs.has(c));
  if (parsed.categories.length === 0) {
    parsed.categories = ['other' as any]; // fallback
  }

  return parsed;
}
