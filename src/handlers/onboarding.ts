import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { updateUser, setConversationState, clearConversationState } from '../db/supabase.js';
import { searchByCommand } from '../services/eventSearch.js';
import { formatEventList } from '../utils/formatter.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const BATCHES = [
  [
    { slug: 'tech', label: 'Tech & Coding' },
    { slug: 'cultural', label: 'Cultural' },
    { slug: 'sports', label: 'Sports' },
  ],
  [
    { slug: 'career', label: 'Career' },
    { slug: 'startup', label: 'Startups' },
    { slug: 'academic', label: 'Academic' },
  ],
  [
    { slug: 'social', label: 'Social & Chill' },
    { slug: 'workshop', label: 'Workshops' },
    { slug: 'competition', label: 'Competitions' },
  ],
];

/**
 * Handle first-time user onboarding -- short, fast, button-driven.
 */
export async function handleOnboarding(user: User, _message: WhatsAppMessage): Promise<void> {
  await setConversationState(user.id, 'onboarding_interests', {
    selectedInterests: [],
    batch: 0,
  });

  const name = user.name ? ` ${user.name.split(' ')[0]}` : '';

  await sendText(user.phone,
    `Hey${name}! I'm Saturn -- I track every club event at IIT Delhi.\n\n` +
    `Ask me anything like "what's tonight?" and I'll find it.\n\n` +
    `Quick setup -- what are you into?`
  );

  await new Promise(r => setTimeout(r, 400));
  await sendInterestBatch(user, 0);
}

/**
 * Send a batch of 3 interest buttons.
 */
async function sendInterestBatch(user: User, batchIndex: number): Promise<void> {
  if (batchIndex >= BATCHES.length) {
    await finishOnboarding(user);
    return;
  }

  const batch = BATCHES[batchIndex];
  const buttons = batch.map(cat => ({
    type: 'reply' as const,
    reply: { id: `interest_${cat.slug}`, title: cat.label },
  }));

  const prompt = batchIndex === 0
    ? 'Tap any that interest you:'
    : 'More options:';

  await sendButtons(user.phone, prompt, buttons);
}

/**
 * Handle interest selection during onboarding.
 */
export async function handleOnboardingReply(user: User, message: WhatsAppMessage): Promise<void> {
  const replyId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
  const text = message.text?.body?.trim().toLowerCase() || '';

  // "done", "skip", or non-interest message = finish
  if (replyId === 'onboarding_done' || text === 'skip' || text === 'done') {
    await finishOnboarding(user);
    return;
  }

  // "next batch" button
  if (replyId === 'onboarding_next') {
    const { getConversationState } = await import('../db/supabase.js');
    const state = await getConversationState(user.id);
    const currentBatch = (state?.data?.batch ?? 0) + 1;
    await setConversationState(user.id, 'onboarding_interests', {
      selectedInterests: state?.data?.selectedInterests || user.interests || [],
      batch: currentBatch,
    });
    if (currentBatch >= BATCHES.length) {
      await finishOnboarding(user);
    } else {
      await sendInterestBatch(user, currentBatch);
    }
    return;
  }

  if (!replyId.startsWith('interest_')) {
    // User typed something random -- finish onboarding, route their message
    await finishOnboarding(user);
    return;
  }

  // Add the selected interest
  const category = replyId.replace('interest_', '');
  const currentInterests = user.interests || [];

  if (!currentInterests.includes(category)) {
    currentInterests.push(category);
    await updateUser(user.id, { interests: currentInterests } as any);
    user.interests = currentInterests;
  }

  const cat = categoriesConfig.categories.find(c => c.slug === category);
  const catLabel = cat?.label || category;

  // Find which batch this was in, then show next batch or finish
  const { getConversationState } = await import('../db/supabase.js');
  const state = await getConversationState(user.id);
  const currentBatch = state?.data?.batch ?? 0;
  const nextBatch = currentBatch + 1;

  await setConversationState(user.id, 'onboarding_interests', {
    selectedInterests: currentInterests,
    batch: nextBatch,
  });

  if (nextBatch >= BATCHES.length) {
    // Show one final prompt
    await sendButtons(
      user.phone,
      `Added ${catLabel}! You're all set.`,
      [
        { type: 'reply', reply: { id: 'onboarding_done', title: 'Show me events!' } },
        { type: 'reply', reply: { id: 'onboarding_next', title: 'Pick more' } },
      ]
    );
    // Re-send the full batch list for "pick more"
  } else {
    await sendText(user.phone, `Added ${catLabel}!`);
    await new Promise(r => setTimeout(r, 300));
    await sendInterestBatch(user, nextBatch);
  }
}

/**
 * Finish onboarding and immediately show relevant events.
 */
async function finishOnboarding(user: User): Promise<void> {
  await updateUser(user.id, { onboarded: true } as any);
  await clearConversationState(user.id);

  const interests = user.interests || [];
  let greeting = 'You\'re all set!';

  if (interests.length > 0) {
    const labels = interests
      .map(slug => categoriesConfig.categories.find(c => c.slug === slug)?.label || slug)
      .slice(0, 4)
      .join(', ');
    greeting += ` Watching: ${labels}.`;
  }

  await sendText(user.phone, greeting);
  await new Promise(r => setTimeout(r, 400));

  // Show upcoming events matching interests
  const events = await searchByCommand('this_week',
    interests.length > 0 ? { categories: interests } : {}
  );

  if (events.length > 0) {
    await sendText(user.phone, formatEventList(events.slice(0, 5), 'Coming up for you'));

    const { setConversationState } = await import('../db/supabase.js');
    await setConversationState(user.id, 'viewing_search_results', {
      events: events.slice(0, 5).map(e => e.id),
    }, 60);
  } else {
    await sendButtons(user.phone, 'No matching events this week yet. I\'ll notify you when something comes up!', [
      { type: 'reply', reply: { id: 'action_clubs', title: 'Browse Clubs' } },
      { type: 'reply', reply: { id: 'action_this_week', title: 'All This Week' } },
    ]);
  }
}
