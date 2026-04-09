import type { User } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { saveEvent, unsaveEvent, getSavedEvents } from '../db/supabase.js';
import { formatEventList } from '../utils/formatter.js';

/**
 * Handle /save <event_id_or_title> or save button tap.
 */
export async function handleSaveEvent(user: User, eventParam: string): Promise<void> {
  try {
    const { supabase } = await import('../db/supabase.js');
    let event;

    // Check if it's a UUID (from interactive button)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventParam);

    if (isUUID) {
      const { data } = await supabase
        .from('events')
        .select('id, title')
        .eq('id', eventParam)
        .eq('status', 'confirmed')
        .single();
      event = data;
    } else {
      // Fallback search by title if user manually typed /save Name
      const { data } = await supabase
        .from('events')
        .select('id, title')
        .ilike('title', `%${eventParam}%`)
        .eq('status', 'confirmed')
        .limit(1)
        .single();
      event = data;
    }

    if (!event) {
      await sendText(user.phone, 'Event not found. Make sure you tapped the Save button on a valid event.');
      return;
    }

    await saveEvent(user.id, event.id);
    await sendText(user.phone, `Saved [${event.title}]!\nView your saved events anytime with /saved`);

  } catch (error: any) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      await sendText(user.phone, 'Event already saved!');
    } else {
      console.error('Save error:', error.message);
      await sendText(user.phone, 'Couldn\'t save the event. Please try again.');
    }
  }
}

/**
 * Handle /unsave <event_id_or_title>.
 */
export async function handleUnsaveEvent(user: User, eventParam: string): Promise<void> {
  try {
    const { supabase } = await import('../db/supabase.js');
    let event;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventParam);

    if (isUUID) {
      const { data } = await supabase
        .from('events')
        .select('id, title')
        .eq('id', eventParam)
        .single();
      event = data;
    } else {
      const { data } = await supabase
        .from('events')
        .select('id, title')
        .ilike('title', `%${eventParam}%`)
        .limit(1)
        .single();
      event = data;
    }

    if (!event) {
      await sendText(user.phone, 'Event not found.');
      return;
    }

    await unsaveEvent(user.id, event.id);
    await sendText(user.phone, `Removed [${event.title}] from saved events.`);

  } catch (error: any) {
    console.error('Unsave error:', error.message);
    await sendText(user.phone, 'Couldn\'t unsave the event. Please try again.');
  }
}

/**
 * Handle /saved — show saved events.
 */
export async function handleSavedEvents(user: User): Promise<void> {
  try {
    const events = await getSavedEvents(user.id);

    if (events.length === 0) {
      await sendButtons(user.phone, 'No saved events yet. Browse events and tap Save to bookmark them!', [
        { type: 'reply', reply: { id: 'action_today', title: 'Today\'s Events' } },
        { type: 'reply', reply: { id: 'action_this_week', title: 'This Week' } },
      ]);
      return;
    }

    await sendText(user.phone, formatEventList(events, 'Your Saved Events'));

    const { setConversationState } = await import('../db/supabase.js');
    await setConversationState(user.id, 'viewing_search_results', {
      events: events.slice(0, 10).map(e => e.id),
    }, 60);

  } catch (error: any) {
    console.error('Saved events error:', error.message);
    await sendText(user.phone, 'Couldn\'t load your saved events. Please try again.');
  }
}
