import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { updateUser, setConversationState, clearConversationState } from '../db/supabase.js';
import { searchByCommand } from '../services/eventSearch.js';
import { formatEventList } from '../utils/formatter.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

/**
 * Handle first-time user onboarding.
 */
export async function handleOnboarding(user: User, message: WhatsAppMessage): Promise<void> {
  // Set conversation state
  await setConversationState(user.id, 'onboarding_interests', { selectedInterests: [] });

  const welcome = `👋 Hey${user.name ? ` ${user.name}` : ''}! I'm *EventX* — your IIT Delhi event discovery bot.

I keep track of all club events happening on campus. Ask me things like "what's happening tonight?" or "any tech events this week?"

First, let me know what you're into so I can personalize your experience!`;

  await sendText(user.phone, welcome);

  // Send interest options in batches (WhatsApp max 3 buttons per message)
  const cats = categoriesConfig.categories;

  for (let i = 0; i < cats.length; i += 3) {
    const batch = cats.slice(i, i + 3);
    await sendButtons(
      user.phone,
      i === 0 ? 'Tap the categories that interest you:' : 'More categories:',
      batch.map(c => ({
        type: 'reply' as const,
        reply: {
          id: `interest_${c.slug}`,
          title: `${c.emoji} ${c.label}`.substring(0, 20),
        },
      }))
    );
  }

  // Send "Done" button
  await sendButtons(
    user.phone,
    "Tap Done when you've selected your interests, or just send any message to skip!",
    [{ type: 'reply' as const, reply: { id: 'onboarding_done', title: '✅ Done' } }]
  );
}

/**
 * Handle interest selection during onboarding.
 */
export async function handleOnboardingReply(user: User, message: WhatsAppMessage): Promise<void> {
  const replyId = message.interactive?.button_reply?.id || '';

  if (replyId === 'onboarding_done' || !replyId.startsWith('interest_')) {
    // Finish onboarding
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

    const cat = categoriesConfig.categories.find(c => c.slug === category);
    await sendText(user.phone, `${cat?.emoji || '✅'} Added *${cat?.label || category}*! Tap more or hit Done.`);
  }
}

/**
 * Finish onboarding and show relevant events.
 */
async function finishOnboarding(user: User): Promise<void> {
  await updateUser(user.id, { onboarded: true } as any);
  await clearConversationState(user.id);

  const interests = user.interests || [];
  let greeting = '🎉 You\'re all set!';

  if (interests.length > 0) {
    const labels = interests
      .map(slug => categoriesConfig.categories.find(c => c.slug === slug)?.label || slug)
      .join(', ');
    greeting += ` I'll keep an eye on: *${labels}*`;
  }

  greeting += '\n\nHere\'s what\'s happening soon:';
  await sendText(user.phone, greeting);

  // Show upcoming events
  const events = await searchByCommand('this_week', 
    interests.length > 0 ? { categories: interests } : {}
  );

  if (events.length > 0) {
    await sendText(user.phone, formatEventList(events, 'This Week'));
  } else {
    await sendText(user.phone, 'No events matching your interests this week. I\'ll notify you when new ones are posted!\n\nType /help to see all commands.');
  }
}
