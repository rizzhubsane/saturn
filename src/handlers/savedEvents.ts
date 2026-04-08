import type { User } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { saveEvent, unsaveEvent, getSavedEvents } from '../db/supabase.js';
import { formatEventList } from '../utils/formatter.js';

/**
 * Handle /save <event_id> or save button tap.
 */
export async function handleSaveEvent(user: User, eventIdPrefix: string): Promise<void> {
  try {
    // Find event by ID prefix
    const { supabase } = await import('../db/supabase.js');
    const { data: event } = await supabase
      .from('events')
      .select('id, title')
      .like('id', `${eventIdPrefix}%`)
      .eq('status', 'confirmed')
      .limit(1)
      .single();

    if (!event) {
      await sendText(user.phone, '❌ Event not found.');
      return;
    }

    await saveEvent(user.id, event.id);
    await sendText(user.phone, `💾 Saved *${event.title}*!\n\nView your saved events anytime with /saved`);

  } catch (error: any) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      await sendText(user.phone, '✅ Event already saved!');
    } else {
      console.error('❌ Save error:', error.message);
      await sendText(user.phone, '❌ Couldn\'t save the event. Please try again.');
    }
  }
}

/**
 * Handle /unsave <event_id>.
 */
export async function handleUnsaveEvent(user: User, eventIdPrefix: string): Promise<void> {
  try {
    const { supabase } = await import('../db/supabase.js');
    const { data: event } = await supabase
      .from('events')
      .select('id, title')
      .like('id', `${eventIdPrefix}%`)
      .limit(1)
      .single();

    if (!event) {
      await sendText(user.phone, '❌ Event not found.');
      return;
    }

    await unsaveEvent(user.id, event.id);
    await sendText(user.phone, `🗑️ Removed *${event.title}* from saved events.`);

  } catch (error: any) {
    console.error('❌ Unsave error:', error.message);
    await sendText(user.phone, '❌ Couldn\'t unsave the event. Please try again.');
  }
}

/**
 * Handle /saved — show saved events.
 */
export async function handleSavedEvents(user: User): Promise<void> {
  try {
    const events = await getSavedEvents(user.id);

    if (events.length === 0) {
      await sendText(user.phone, '💾 No saved events yet.\n\nBrowse events with /today or /week, then tap 💾 to save ones you like!');
      return;
    }

    await sendText(user.phone, formatEventList(events, 'Your Saved Events'));

  } catch (error: any) {
    console.error('❌ Saved events error:', error.message);
    await sendText(user.phone, '❌ Couldn\'t load your saved events. Please try again.');
  }
}
