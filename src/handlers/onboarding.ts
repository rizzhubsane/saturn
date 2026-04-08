import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText, sendList } from '../services/whatsapp.js';
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

  const welcome = `Hey${user.name ? ` ${user.name}` : ''}! I'm Saturn, your IIT Delhi event discovery assistant.\n\nI keep track of all club events happening on campus. You don't need to learn any commands—just ask me what you're looking for! For example: "any tech talks today?" or "show me weekend sports events."\n\nFirst, let me know what you're generally into:`;

  // Send single list message
  const rows = categoriesConfig.categories.slice(0, 9).map(c => ({
    id: `interest_${c.slug}`,
    title: c.label.substring(0, 24),
  }));
  
  // Add done option to the same list section
  rows.push({
    id: 'onboarding_done',
    title: 'Done / Skip',
  });

  await sendList(
    user.phone,
    welcome,
    'Select Interests',
    [{ title: 'Categories', rows }]
  );
}

/**
 * Handle interest selection during onboarding.
 */
export async function handleOnboardingReply(user: User, message: WhatsAppMessage): Promise<void> {
  const replyId = message.interactive?.list_reply?.id || message.interactive?.button_reply?.id || '';

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
    
    await sendList(
      user.phone,
      `Added ${cat?.label || category}. Select more, or tap Done.`,
      'Options',
      [{
        title: 'Actions',
        rows: [
          { id: 'onboarding_done', title: 'Done / Finish' },
          ...categoriesConfig.categories.slice(0, 9).map(c => ({
            id: `interest_${c.slug}`,
            title: c.label.substring(0, 24),
          }))
        ]
      }]
    );
  } else {
    // already selected
    await sendList(user.phone, `You already selected ${category}. Tap Done to finish.`, 'Options', [{ title: 'Actions', rows: [{ id: 'onboarding_done', title: 'Done / Finish' }] }]);
  }
}

/**
 * Finish onboarding and show relevant events.
 */
async function finishOnboarding(user: User): Promise<void> {
  await updateUser(user.id, { onboarded: true } as any);
  await clearConversationState(user.id);

  const interests = user.interests || [];
  let greeting = 'You\'re all set!';

  if (interests.length > 0) {
    const labels = interests
      .map(slug => categoriesConfig.categories.find(c => c.slug === slug)?.label || slug)
      .join(', ');
    greeting += ` I'll keep an eye on: ${labels}`;
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
    await sendText(user.phone, 'No events matching your interests this week. I\'ll notify you when new ones are posted!\n\nJust message me anytime if you want to search.');
  }
}

