import type { User } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { formatHelp, formatEventList } from '../utils/formatter.js';
import { searchByCommand } from '../services/eventSearch.js';

/**
 * Handle /help command -- sends role-differentiated help + action buttons.
 */
export async function handleHelp(user: User): Promise<void> {
  const helpText = formatHelp(user.role);

  try {
    await sendText(user.phone, helpText);

    await new Promise(resolve => setTimeout(resolve, 500));

    // Role-appropriate quick action buttons
    if (user.role === 'god' || user.role === 'admin' || user.role === 'power_user') {
      await sendButtons(user.phone, 'Quick actions:', [
        { type: 'reply', reply: { id: 'action_post_another', title: 'Post Event' } },
        { type: 'reply', reply: { id: 'action_today', title: 'Today\'s Events' } },
        { type: 'reply', reply: { id: 'action_clubs', title: 'Browse Clubs' } },
      ]);
    } else {
      await sendButtons(user.phone, 'What would you like to do?', [
        { type: 'reply', reply: { id: 'action_today', title: 'Today\'s Events' } },
        { type: 'reply', reply: { id: 'action_this_week', title: 'This Week' } },
        { type: 'reply', reply: { id: 'action_clubs', title: 'Browse Clubs' } },
      ]);
    }

  } catch (err) {
    // silently fail on buttons
  }
}
