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
  "highlights": ["1-2 short strings capturing the CORE HOOKS — what makes this event worth attending"],
  "links": [{"url": "extracted URL", "label": "register|website|instagram|form|info|other"}],
  "event_type": "one of: hackathon, workshop, talk, fest, performance, screening, meetup, competition, trip, seminar, panel, other",
  "registration_link": "primary registration URL or null",
  "is_all_day": false,
  "confidence": 0.0-1.0
}

HIGHLIGHTS GUIDE — extract what makes a student WANT to show up:
- The SPEAKER or GUEST: "Keynote by CEO of Razorpay", "Talk by Prof. Amartya Sen"
- The OPPORTUNITY: "Internship shortlist for top 10", "Pitch to real VCs", "Winner gets incubation"
- The LEARNING: "Hands-on Rust workshop", "Learn ML from scratch in 3 hours"
- The EXPERIENCE: "Live jam session", "Open mic night", "Campus-wide treasure hunt"
- The BENEFIT: "Certificate from IIT Delhi", "Letter of recommendation", "Pre-placement interview"
- The STAKES: "Prize pool Rs 1L", "Winner represents IITD at nationals"
Keep highlights SHORT (3-8 words each). Pick 1-2 that best capture the core draw.
Do NOT list generic things like "free entry" or "open to all" — those are not highlights.

LINKS: Extract ALL URLs found in the message and OCR text. Classify each by purpose.
If multiple links exist, set registration_link to the primary registration/form URL.

If a field cannot be determined, use null. For date, you MUST provide a value.

HINTS FOR CATEGORIES:
- Blood donation, charity, welfare, mental health -> "wellness"
- Stand-up comedy, movie nights, casual meetups -> "cultural" or "social"
- Resume building, placement talks -> "career"
- Hackathons -> "tech" and "competition"
- Hardware, core engineering, physics, aeromodelling, biology -> "engineering"
- Case studies, quantitative finance, consulting workshops -> "finance"`;

/**
 * Parse a raw club publicity message into structured event data.
 */
export async function parseEventMessage(
  rawMessage: string,
  ocrText: string = ''
): Promise<ParsedEvent> {
  const today = getTodayIST();

  const systemPrompt = PARSE_SYSTEM_PROMPT
    .replace('{{CURRENT_DATE}}', today)
    .replace('{{VENUE_MAP_JSON}}', JSON.stringify(venueMap))
    .replace('{{CATEGORIES_JSON}}', JSON.stringify(categoriesConfig.categories.map(c => ({ slug: c.slug, label: c.label }))));

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
    parsed.categories = ['other' as any];
  }

  // Ensure arrays exist
  parsed.highlights = parsed.highlights || [];
  parsed.links = parsed.links || [];
  parsed.event_type = parsed.event_type || 'other';

  // Back-fill registration_link from links array if not set
  if (!parsed.registration_link && parsed.links.length > 0) {
    const regLink = parsed.links.find(l => l.label === 'register' || l.label === 'form');
    parsed.registration_link = regLink?.url || parsed.links[0].url;
  }

  return parsed;
}

const EDIT_SYSTEM_PROMPT = `You are editing a previously parsed campus event. You receive the current structured event data as JSON and a user's edit instruction. Apply ONLY the requested change(s) and return the full updated JSON.

Today's date is: {{CURRENT_DATE}}

Known venue shorthands:
{{VENUE_MAP_JSON}}

Available categories:
{{CATEGORIES_JSON}}

Rules:
- Only modify the fields the user explicitly asks to change.
- Keep all other fields EXACTLY as they were.
- Return the complete JSON object (same schema as input).
- If the user asks to add a highlight, append to the highlights array.
- If the user asks to add a link, append to the links array.
- If the user says something ambiguous, make your best guess and set confidence accordingly.

Respond with ONLY the updated JSON object, no markdown, no backticks.`;

/**
 * Apply a user's edit instruction to a previously parsed event.
 */
export async function applyEventEdit(
  previousParsed: ParsedEvent,
  editInstruction: string
): Promise<ParsedEvent> {
  const today = getTodayIST();

  const systemPrompt = EDIT_SYSTEM_PROMPT
    .replace('{{CURRENT_DATE}}', today)
    .replace('{{VENUE_MAP_JSON}}', JSON.stringify(venueMap))
    .replace('{{CATEGORIES_JSON}}', JSON.stringify(categoriesConfig.categories.map(c => ({ slug: c.slug, label: c.label }))));

  const userPrompt = `CURRENT PARSED EVENT:\n${JSON.stringify(previousParsed, null, 2)}\n\nUSER'S EDIT INSTRUCTION:\n${editInstruction}`;

  const updated = await completeJSON<ParsedEvent>(systemPrompt, userPrompt, {
    temperature: 0.2,
  });

  // Validate
  if (!updated.title) updated.title = previousParsed.title;
  if (!updated.date) updated.date = previousParsed.date;

  // Normalize categories
  const validSlugs = new Set(categoriesConfig.categories.map(c => c.slug));
  updated.categories = (updated.categories || []).filter(c => validSlugs.has(c));
  if (updated.categories.length === 0) {
    updated.categories = previousParsed.categories;
  }

  updated.highlights = updated.highlights || [];
  updated.links = updated.links || [];
  updated.event_type = updated.event_type || previousParsed.event_type || 'other';

  return updated;
}
