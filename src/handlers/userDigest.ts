import type { User, WhatsAppMessage, Event } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { setConversationState, clearConversationState, getUserSubscriptions, setUserSubscriptions, updateUser, queryEvents } from '../db/supabase.js';
import { getTodayIST } from '../utils/dateParser.js';
import { formatDigest } from '../utils/formatter.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const categorySlugSet = new Set(categoriesConfig.categories.map(c => c.slug));
const categoryMap = new Map(categoriesConfig.categories.map(c => [c.slug, c]));

/**
 * Starts preference collection flow for personalized daily digest.
 */
export async function handleDigestSetup(user: User): Promise<void> {
  const existingSubs = await getUserSubscriptions(user.id);
  const existingInterests = user.interests || [];
  const existing = Array.from(new Set([...existingSubs, ...existingInterests])).filter(c => categorySlugSet.has(c));

  const available = categoriesConfig.categories
    .map(c => `- ${c.slug} (${c.label})`)
    .join('\n');

  await setConversationState(user.id, 'awaiting_digest_preferences', {}, 60);

  const current = existing.length > 0
    ? `Current preferences: ${existing.map(slug => categoryMap.get(slug)?.label || slug).join(', ')}\n\n`
    : '';

  await sendText(
    user.phone,
    `Let's set up your personalized daily digest.\n\n` +
    `${current}` +
    `Tell me what you want in your digest (in general).\n` +
    `Example: "tech, startup, career"\n\n` +
    `Available categories:\n${available}\n\n` +
    `Tip: Reply "all" for unfiltered digest.`
  );
}

/**
 * Handles user reply while collecting digest preferences.
 */
export async function handleDigestPreferenceReply(user: User, message: WhatsAppMessage): Promise<void> {
  const text = message.text?.body?.trim().toLowerCase() || '';
  if (!text) {
    await sendText(user.phone, 'Please send categories like "tech, startup" or "all".');
    return;
  }

  const selected = parseCategoriesFromText(text);
  const wantsAll = /\ball\b/.test(text);

  if (!wantsAll && selected.length === 0) {
    await sendText(
      user.phone,
      `I couldn't detect a valid preference. Try like:\n` +
      `"tech, sports"\n` +
      `"career and startup"\n` +
      `"all"`
    );
    return;
  }

  const preferences = wantsAll ? [] : selected;

  await setUserSubscriptions(user.id, preferences);
  await updateUser(user.id, { interests: preferences } as Partial<User>);
  await clearConversationState(user.id);

  const todayEvents = await getTodayDigestEvents(preferences);
  const digestHeader = wantsAll
    ? '*Your Daily Digest (All Categories)*'
    : `*Your Daily Digest* (Filtered: ${preferences.map(slug => categoryMap.get(slug)?.label || slug).join(', ')})`;

  if (todayEvents.length === 0) {
    await sendText(
      user.phone,
      `${digestHeader}\n\nNo matching events for today yet. Your preferences are saved — ask me again later or try /today.`
    );
    return;
  }

  await sendText(user.phone, `${digestHeader}\n\n${formatDigest(todayEvents, 'morning')}`);
}

function parseCategoriesFromText(text: string): string[] {
  const selected = new Set<string>();
  const normalized = text.toLowerCase();

  for (const category of categoriesConfig.categories) {
    if (normalized.includes(category.slug)) {
      selected.add(category.slug);
      continue;
    }

    const labelWords = category.label
      .toLowerCase()
      .replace(/&/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (labelWords.some(word => normalized.includes(word))) {
      selected.add(category.slug);
    }
  }

  return Array.from(selected);
}

async function getTodayDigestEvents(categories: string[]): Promise<Event[]> {
  const today = getTodayIST();
  return queryEvents({
    dateStart: today,
    dateEnd: today,
    status: 'confirmed',
    categories: categories.length > 0 ? categories : undefined,
  });
}
