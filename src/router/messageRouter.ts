import type { User, WhatsAppMessage } from '../types/index.js';
import { getConversationState } from '../db/supabase.js';
import { GOD_PHONE } from '../config/env.js';
import { sendText } from '../services/whatsapp.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

// Import handlers
import { handleHelp } from '../handlers/help.js';
import { handleOnboarding, handleOnboardingReply } from '../handlers/onboarding.js';
import { handleRegisterClub } from '../handlers/registerClub.js';
import { handleJoinClub } from '../handlers/joinClub.js';
import { handlePostEvent, handlePostContent } from '../handlers/postEvent.js';
import { handleConfirmEvent } from '../handlers/confirmEvent.js';
import { handleQueryEvents, handleEventDetail } from '../handlers/queryEvents.js';
import { handleReminder } from '../handlers/reminders.js';
import { handleSavedEvents, handleSaveEvent, handleUnsaveEvent } from '../handlers/savedEvents.js';
import { handleSubscribe, handleUnsubscribe, handleMySubscriptions } from '../handlers/subscriptions.js';
import { handleClubDiscovery, handleClubDetail } from '../handlers/clubDiscovery.js';
import { handleClubProfile, handleEditClub } from '../handlers/clubProfile.js';
import { handleAdminCommands } from '../handlers/adminCommands.js';
import { handleGodCommands } from '../handlers/godCommands.js';

const categorySlugSet = new Set(categoriesConfig.categories.map(c => c.slug));

/**
 * Main message router — determines the user's intent and routes to the correct handler.
 */
export async function routeMessage(user: User, message: WhatsAppMessage): Promise<void> {
  try {
    // Promote god phone
    const godPhones = GOD_PHONE.split(',').map(p => p.replace('+', '').trim());
    if (godPhones.includes(user.phone.replace('+', '')) && user.role !== 'god') {
      // Auto-promote to god on first message
      const { updateUser } = await import('../db/supabase.js');
      await updateUser(user.id, { role: 'god' } as any);
      user.role = 'god';
    }

    // ── Step 1: Check for active conversation state ──
    const state = await getConversationState(user.id);
    if (state) {
      return await handleStatefulMessage(user, message, state);
    }

    // ── Step 2: Check if user needs onboarding ──
    if (!user.onboarded && user.role === 'user') {
      // But first check if they're sending a command that should bypass onboarding
      const text = message.text?.body?.trim().toLowerCase() || '';
      if (!text.startsWith('/register') && !text.startsWith('/join') && !text.startsWith('/help')) {
        return await handleOnboarding(user, message);
      }
    }

    // ── Step 3: Handle interactive replies (button/list taps) ──
    if (message.type === 'interactive') {
      return await handleInteractiveReply(user, message);
    }

    // ── Step 4: Command-based routing ──
    const text = message.text?.body?.trim() || '';
    const textLower = text.toLowerCase();

    // Help & Greetings
    if (['/help', '/menu', '/start'].includes(textLower)) {
      return await handleHelp(user);
    }

    // Club registration
    if (textLower.startsWith('/register ') || textLower === '/register') {
      return await handleRegisterClub(user, message);
    }

    // Join club
    if (textLower.startsWith('/join ') || textLower === '/join') {
      return await handleJoinClub(user, message);
    }

    // Post event
    if (textLower.startsWith('/post')) {
      return await handlePostEvent(user, message);
    }

    // My events
    if (textLower === '/myevents') {
      return await handleQueryEvents(user, 'myevents');
    }

    // Time-based queries
    if (textLower === '/today') return await handleQueryEvents(user, 'today');
    if (textLower === '/tomorrow') return await handleQueryEvents(user, 'tomorrow');
    if (textLower === '/week' || textLower === '/thisweek') return await handleQueryEvents(user, 'this_week');
    if (textLower === '/weekend') return await handleQueryEvents(user, 'this_weekend');

    // Search
    if (textLower.startsWith('/search ')) {
      const keyword = text.substring(8).trim();
      return await handleQueryEvents(user, 'search', keyword);
    }

    // Category queries (e.g., /tech, /cultural, /sports)
    if (textLower.startsWith('/')) {
      const potentialCategory = textLower.substring(1).trim();
      if (categorySlugSet.has(potentialCategory)) {
        return await handleQueryEvents(user, 'category', potentialCategory);
      }
    }

    // Club discovery
    if (textLower === '/clubs') return await handleClubDiscovery(user);
    if (textLower.startsWith('/clubs ')) {
      const category = text.substring(7).trim();
      return await handleClubDiscovery(user, category);
    }
    if (textLower.startsWith('/club ')) {
      const clubName = text.substring(6).trim();
      return await handleClubDetail(user, clubName);
    }

    // Club management (admin/power user)
    if (textLower === '/clubinfo') return await handleClubProfile(user);
    if (textLower === '/editclub') return await handleEditClub(user, message);

    // Saved events
    if (textLower === '/saved') return await handleSavedEvents(user);
    if (textLower.startsWith('/save ')) {
      const eventId = text.substring(6).trim();
      return await handleSaveEvent(user, eventId);
    }
    if (textLower.startsWith('/unsave ')) {
      const eventId = text.substring(8).trim();
      return await handleUnsaveEvent(user, eventId);
    }

    // Reminders
    if (textLower.startsWith('/remind ')) {
      const eventId = text.substring(8).trim();
      return await handleReminder(user, eventId);
    }

    // Subscriptions
    if (textLower.startsWith('/subscribe ')) {
      const category = text.substring(11).trim();
      return await handleSubscribe(user, category);
    }
    if (textLower.startsWith('/unsubscribe ')) {
      const category = text.substring(13).trim();
      return await handleUnsubscribe(user, category);
    }
    if (textLower === '/mysubs') return await handleMySubscriptions(user);

    // Admin commands
    if (textLower.startsWith('/adduser ') || textLower.startsWith('/removeuser ') || 
        textLower === '/orginfo' || textLower === '/analytics') {
      return await handleAdminCommands(user, message);
    }

    // God commands
    if (textLower.startsWith('/addorg ') || textLower.startsWith('/promote ') || 
        textLower.startsWith('/broadcast ') || textLower === '/stats' || textLower === '/purge') {
      if (user.role !== 'god') {
        return await sendText(user.phone, '❌ This command is restricted.');
      }
      return await handleGodCommands(user, message);
    }

    // ── Step 5: Natural language query (fallback) ──
    return await handleQueryEvents(user, 'natural', text);

  } catch (error: any) {
    console.error(`❌ Error routing message for ${user.phone}:`, error.message, error.stack);
    await sendText(user.phone, '😅 Something went wrong. Please try again in a moment.');
  }
}

/**
 * Handle messages when user has active conversation state.
 */
async function handleStatefulMessage(user: User, message: WhatsAppMessage, state: any): Promise<void> {
  switch (state.state) {
    case 'awaiting_event_content':
      return await handlePostContent(user, message, state);

    case 'awaiting_confirmation':
      // If it's an interactive reply, handle normally
      if (message.type === 'interactive') {
        return await handleInteractiveReply(user, message);
      }
      // Text response to confirmation
      const text = message.text?.body?.trim().toLowerCase() || '';
      if (text === 'y' || text === 'yes' || text === 'confirm') {
        return await handleConfirmEvent(user, 'confirm', state);
      }
      if (text === 'n' || text === 'no' || text === 'cancel') {
        return await handleConfirmEvent(user, 'cancel', state);
      }
      return await sendText(user.phone, 'Please reply with *Y* to confirm or *N* to cancel. Or use the buttons above.');

    case 'awaiting_edit':
      return await handlePostContent(user, message, state);

    case 'onboarding_interests':
      return await handleOnboardingReply(user, message);

    case 'editing_club':
      return await handleEditClub(user, message);

    case 'viewing_search_results': {
      const textParam = message.text?.body?.trim() || '';
      const num = parseInt(textParam);

      // If user typed a number between 1 and the length of events list
      if (!isNaN(num) && num > 0 && state.data?.events && num <= state.data.events.length) {
        const eventId = state.data.events[num - 1];
        const { handleEventDetail } = await import('../handlers/queryEvents.js');
        return await handleEventDetail(user, eventId);
      }

      // If it's something else, clear state and route normally
      const { clearConversationState } = await import('../db/supabase.js');
      await clearConversationState(user.id);
      return await routeMessage(user, message);
    }

    default:
      // Unknown state — clear and re-route
      const { clearConversationState } = await import('../db/supabase.js');
      await clearConversationState(user.id);
      return await routeMessage(user, message);
  }
}

/**
 * Handle interactive reply messages (button taps, list selections).
 */
async function handleInteractiveReply(user: User, message: WhatsAppMessage): Promise<void> {
  const replyId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';

  // Fallback notify buttons
  if (replyId === 'subscribe_prompt') {
    await sendText(user.phone, 
      "Sure! Just tell me what you're into and I'll watch for events:\n\n" +
      "For example:\n" +
      "- \"Notify me about tech events\"\n" +
      "- \"/subscribe sports\"\n" +
      "- \"/subscribe cultural\"\n\n" +
      "Or use /clubs to browse all campus clubs and follow ones you like!"
    );
    return;
  }
  if (replyId === 'cancel_prompt') {
    const { sendText } = await import('../services/whatsapp.js');
    await sendText(user.phone, "No worries! Just ask when you're looking for something.");
    return;
  }

  // Parse the action from the reply ID prefix
  if (replyId.startsWith('confirm_evt_')) {
    const state = await getConversationState(user.id);
    return await handleConfirmEvent(user, 'confirm', state);
  }
  if (replyId.startsWith('edit_evt_')) {
    const state = await getConversationState(user.id);
    return await handleConfirmEvent(user, 'edit', state);
  }
  if (replyId.startsWith('cancel_evt_')) {
    const state = await getConversationState(user.id);
    return await handleConfirmEvent(user, 'cancel', state);
  }

  if (replyId.startsWith('remind_')) {
    const eventId = replyId.replace('remind_', '');
    return await handleReminder(user, eventId);
  }
  if (replyId.startsWith('pass_')) {
    const { sendText } = await import('../services/whatsapp.js');
    return await sendText(user.phone, "Got it! I won't bother you about this one. Ask me if you want to see anything else.");
  }
  if (replyId.startsWith('save_')) {
    const eventId = replyId.replace('save_', '');
    return await handleSaveEvent(user, eventId);
  }
  if (replyId.startsWith('view_')) {
    const eventId = replyId.replace('view_', '');
    return await handleEventDetail(user, eventId);
  }

  // Onboarding interest selection
  if (replyId.startsWith('interest_')) {
    return await handleOnboardingReply(user, message);
  }
  if (replyId === 'onboarding_done') {
    return await handleOnboardingReply(user, message);
  }

  // Club edit fields
  if (replyId.startsWith('clubedit_')) {
    return await handleEditClub(user, message);
  }

  await sendText(user.phone, "I didn't understand that selection. Try /help for available commands.");
}
