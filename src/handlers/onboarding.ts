import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { updateUser, setConversationState, clearConversationState } from '../db/supabase.js';
import { searchByCommand } from '../services/eventSearch.js';
import { formatEventList } from '../utils/formatter.js';
import categoriesConfig from '../config/categories.json' with { type: 'json' };
import { completeJSON } from '../services/llm.js';

const VALID_SLUGS = new Set(categoriesConfig.categories.map(c => c.slug));

const ONBOARDING_PARSE_PROMPT = `You map a WhatsApp user's onboarding message to campus event category slugs for IIT Delhi.

Valid categories (slug is what you output in "categories"):
{{CATEGORIES_JSON}}

Respond with ONLY a JSON object:
{
  "wants_all": boolean,
  "categories": ["slug", ...]
}

Rules:
- "wants_all" true only if they clearly want every category (e.g. "all", "everything", "all of them", "show me everything").
- If they skip, want nothing, or are unsure (e.g. "skip", "none", "not sure", "later"), set wants_all false and categories [].
- Map natural language to slugs: e.g. hackathons/coding/CS → tech; football/cricket → sports; music/drama → cultural; jobs/placements → career; startups → startup; research papers → academic; mental health → wellness; etc.
- Only include slugs that exist in the valid list. If unsure about a phrase, omit it.
- categories must be unique. Empty array is valid.`;

interface ParsedOnboarding {
  wants_all: boolean;
  categories: string[];
}

function formatCategoryCatalog(): string {
  return categoriesConfig.categories
    .map(c => `• *${c.slug}* — ${c.emoji || ''} ${c.label}`.trim())
    .join('\n');
}

/**
 * Parse natural-language interests into validated slugs.
 */
async function parseInterestsFromText(userText: string): Promise<{ slugs: string[]; wantsAll: boolean }> {
  const trimmed = userText.trim();
  if (!trimmed) {
    return { slugs: [], wantsAll: false };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower === 'all' ||
    lower === 'everything' ||
    lower === 'all categories' ||
    lower === 'all of them' ||
    lower === 'show me everything'
  ) {
    return { slugs: [...VALID_SLUGS], wantsAll: true };
  }

  const systemPrompt = ONBOARDING_PARSE_PROMPT.replace(
    '{{CATEGORIES_JSON}}',
    JSON.stringify(
      categoriesConfig.categories.map(c => ({ slug: c.slug, label: c.label, emoji: c.emoji })),
      null,
      0
    )
  );

  const parsed = await completeJSON<ParsedOnboarding>(systemPrompt, `User message:\n${trimmed}`, {
    temperature: 0.15,
  });

  const wantsAll = !!parsed.wants_all;
  if (wantsAll) {
    return { slugs: [...VALID_SLUGS], wantsAll: true };
  }

  const raw = Array.isArray(parsed.categories) ? parsed.categories : [];
  const slugs = [...new Set(raw.map(s => String(s).toLowerCase().trim()).filter(s => VALID_SLUGS.has(s)))];
  return { slugs, wantsAll: false };
}

/**
 * First-time onboarding: show all categories, ask for a natural-language reply.
 */
export async function handleOnboarding(user: User, _message: WhatsAppMessage): Promise<void> {
  await setConversationState(user.id, 'onboarding_interests', {});

  const name = user.name ? ` ${user.name.split(' ')[0]}` : '';

  const intro =
    `Hey${name}! I'm Saturn — I track club events at IIT Delhi.\n\n` +
    `Ask me anything like "what's tonight?" anytime.\n\n` +
    `*Quick setup — what do you care about?* Reply in your own words. For example:\n` +
    `_tech and sports_, _workshops and cultural stuff_, _everything_, or _skip_.\n\n` +
    `*Categories you can mention:*\n${formatCategoryCatalog()}`;

  await sendText(user.phone, intro);
}

/**
 * NL reply while in onboarding — parse interests and finish.
 */
export async function handleOnboardingReply(user: User, message: WhatsAppMessage): Promise<void> {
  const replyId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';

  if (replyId && (replyId.startsWith('interest_') || replyId === 'onboarding_done')) {
    await sendText(
      user.phone,
      'Please *type* your interests in a message (see the category list above). For example: _tech, sports, cultural_ or _everything_.'
    );
    return;
  }

  const text = message.text?.body?.trim() || '';
  const lower = text.toLowerCase();

  if (!text) {
    await sendText(
      user.phone,
      'Send a text reply listing what you\'re into — or say *skip* to skip setup.'
    );
    return;
  }

  if (lower === 'skip' || lower === 'none' || lower === 'no thanks' || lower === 'later') {
    await finishOnboarding(user, []);
    return;
  }

  try {
    const { slugs, wantsAll } = await parseInterestsFromText(text);

    if (wantsAll) {
      await finishOnboarding(user, [...VALID_SLUGS]);
      return;
    }

    if (slugs.length > 0) {
      await finishOnboarding(user, slugs);
      return;
    }

    await sendText(
      user.phone,
      `I couldn't map that to categories yet. Try a few words like *tech*, *sports*, *cultural*, or say *all* for every category, or *skip*.`
    );
  } catch (e: any) {
    console.error('Onboarding parse failed:', e?.message);
    await sendText(
      user.phone,
      `Something went wrong parsing that. Try again with simple words (e.g. *tech and career*) or *skip*.`
    );
  }
}

async function finishOnboarding(user: User, interests: string[]): Promise<void> {
  const unique = [...new Set(interests.filter(s => VALID_SLUGS.has(s)))];

  await updateUser(user.id, { onboarded: true, interests: unique } as any);
  user.interests = unique;
  await clearConversationState(user.id);

  let greeting = "You're all set!";

  if (unique.length > 0) {
    const labels = unique
      .map(slug => categoriesConfig.categories.find(c => c.slug === slug)?.label || slug)
      .slice(0, 8)
      .join(', ');
    greeting += ` Watching: ${labels}.`;
  } else {
    greeting += " I'll show you everything when you search — you can narrow later with /digest.";
  }

  await sendText(user.phone, greeting);
  await new Promise(r => setTimeout(r, 400));

  const events = await searchByCommand(
    'this_week',
    unique.length > 0 ? { categories: unique } : {}
  );

  if (events.length > 0) {
    await sendText(user.phone, formatEventList(events.slice(0, 5), 'Coming up for you'));

    const { setConversationState } = await import('../db/supabase.js');
    await setConversationState(user.id, 'viewing_search_results', {
      events: events.slice(0, 5).map(e => e.id),
    }, 60);
  } else {
    const { sendButtons } = await import('../services/whatsapp.js');
    await sendButtons(user.phone, 'No matching events this week yet. Try broader filters or check back — message me anytime.', [
      { type: 'reply', reply: { id: 'action_clubs', title: 'Browse Clubs' } },
      { type: 'reply', reply: { id: 'action_this_week', title: 'All This Week' } },
    ]);
  }
}
