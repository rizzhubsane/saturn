import type { User } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { createReminder, getEventById, getUserReminders } from '../db/supabase.js';
import { formatHumanDate, formatHumanTime } from '../utils/dateParser.js';

/**
 * Handle /remind <event_id> or reminder button tap.
 */
export async function handleReminder(user: User, eventIdPrefix: string): Promise<void> {
  try {
    // Find event by ID or ID prefix
    const event = await findEventByIdOrPrefix(eventIdPrefix);

    if (!event) {
      await sendText(user.phone, '❌ Event not found. Make sure the event ID is correct.');
      return;
    }

    if (event.status !== 'confirmed') {
      await sendText(user.phone, '❌ This event is no longer active.');
      return;
    }

    // Calculate reminder time (1 hour before event, or 15 min if within the next hour)
    const eventDateTime = buildEventDateTime(event.date, event.time);
    const now = new Date();
    const oneHourBefore = new Date(eventDateTime.getTime() - 60 * 60 * 1000);
    const fifteenMinBefore = new Date(eventDateTime.getTime() - 15 * 60 * 1000);

    if (eventDateTime <= now) {
      await sendText(user.phone, '❌ This event has already started or passed.');
      return;
    }

    const remindAt = oneHourBefore > now ? oneHourBefore : fifteenMinBefore;

    if (remindAt <= now) {
      await sendText(user.phone, `⚡ The event starts very soon! No need for a reminder — it's happening now!`);
      return;
    }

    await createReminder(user.id, event.id, remindAt);

    function generateGCalLink(event: any): string {
      const getUtcDateString = (dateObj: Date) => {
        return dateObj.toISOString().replace(/-|:|\.\d\d\d/g, '');
      };
      
      const startObj = buildEventDateTime(event.date, event.time);
      const endObj = event.end_time 
        ? buildEventDateTime(event.date, event.end_time) 
        : new Date(startObj.getTime() + 2 * 60 * 60 * 1000); // default 2 hours long

      const startDate = getUtcDateString(startObj);
      const endDate = getUtcDateString(endObj);

      const url = new URL('https://calendar.google.com/calendar/render');
      url.searchParams.append('action', 'TEMPLATE');
      url.searchParams.append('text', event.title);
      url.searchParams.append('dates', `${startDate}/${endDate}`);
      
      if (event.description) url.searchParams.append('details', event.description.substring(0, 500));
      if (event.venue) url.searchParams.append('location', event.venue);

      return url.toString();
    }

    const gcalLink = generateGCalLink(event);
    const timeUntil = oneHourBefore > now ? '1 hour' : '15 minutes';
    await sendText(user.phone,
      `Reminder set!\n\n` +
      `I'll ping you ${timeUntil} before *[${event.title}]*.\n` +
      `Date: ${formatHumanDate(event.date)}${event.time ? ` · Time: ${formatHumanTime(event.time)}` : ''}\n` +
      `Location: ${event.venue || 'TBD'}\n\n` +
      `Add to Google Calendar:\n${gcalLink}`
    );

  } catch (error: any) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      await sendText(user.phone, 'You already have a reminder set for this event!');
    } else {
      console.error('Reminder error:', error.message);
      await sendText(user.phone, 'Couldn\'t set the reminder. Please try again.');
    }
  }
}

/**
 * Show user's pending reminders.
 */
export async function handleViewReminders(user: User): Promise<void> {
  const reminders = await getUserReminders(user.id);

  if (reminders.length === 0) {
    await sendText(user.phone, 'No pending reminders.\n\nBrowse events with /today or /week, then tap Remind to set one!');
    return;
  }

  const lines = ['*[Your Reminders]*\n'];
  for (const r of reminders) {
    const evt = r.event as any;
    if (evt) {
      lines.push(`- [${evt.title}] — ${formatHumanDate(evt.date)}${evt.time ? ` · ${formatHumanTime(evt.time)}` : ''}`);
    }
  }

  await sendText(user.phone, lines.join('\n'));
}

// Helpers

async function findEventByIdOrPrefix(idOrPrefix: string): Promise<any> {
  // First try exact match
  const { getEventById: getById } = await import('../db/supabase.js');
  let event = await getById(idOrPrefix);
  if (event) return event;

  // Try as prefix (for short IDs like first 8 chars)
  const { supabase } = await import('../db/supabase.js');
  const { data } = await supabase
    .from('events')
    .select('*, club:clubs(id, name, slug)')
    .like('id', `${idOrPrefix}%`)
    .eq('status', 'confirmed')
    .limit(1)
    .single();

  return data;
}

function buildEventDateTime(dateStr: string, timeStr: string | null): Date {
  if (timeStr) {
    return new Date(`${dateStr}T${timeStr}+05:30`); // IST
  }
  return new Date(`${dateStr}T09:00:00+05:30`); // Default to 9 AM if no time
}
