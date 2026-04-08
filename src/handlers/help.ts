import type { User } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { formatHelp, formatEventList } from '../utils/formatter.js';
import { searchByCommand } from '../services/eventSearch.js';

/**
 * Handle /help command — sends role-aware command list and hot events.
 */
export async function handleHelp(user: User): Promise<void> {
  const helpText = formatHelp(user.role);
  
  try {
    const todayEvents = await searchByCommand('today');
    if (todayEvents.length > 0) {
      const topEventsStr = formatEventList(todayEvents.slice(0, 2), "🔥 Hot Today");
      await sendText(user.phone, `${topEventsStr}\n\n━━━━━━━━━━━━━━━\n\n${helpText}`);
      
      // Since we just showed events, save context so they can reply '1' to view details
      const { setConversationState } = await import('../db/supabase.js');
      await setConversationState(user.id, 'viewing_search_results', { 
        events: todayEvents.slice(0, 2).map(e => e.id)
      }, 60);
      return;
    }
  } catch (err) {
    // silently fail
  }

  await sendText(user.phone, helpText);
}
