import type { User } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { createReminder, getEventById, getUserReminders } from '../db/supabase.js';
import { formatHumanDate, formatHumanTime } from '../utils/dateParser.js';
import {
  buildEventDateTime,
  buildGoogleCalendarUrl,
  buildAppleCalendarWebUrl,
} from '../utils/calendarLinks.js';
import { PUBLIC_BASE_URL } from '../config/env.js';

/**
 * Handle /remind <event_id> or reminder button tap.
 */
export async function handleReminder(user: User, eventIdPrefix: string): Promise<void> {
  try {
    const event = await findEventByIdOrPrefix(eventIdPrefix);

    if (!event) {
      await sendText(user.phone, '❌ Event not found. Make sure the event ID is correct.');
      return;
    }

    if (event.status !== 'confirmed') {
      await sendText(user.phone, '❌ This event is no longer active.');
      return;
    }

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
      await sendText(
        user.phone,
        `⚡ The event starts very soon! No need for a reminder — it's happening now!`
      );
      return;
    }

    await createReminder(user.id, event.id, remindAt);

    const { saveEvent } = await import('../db/supabase.js');
    await saveEvent(user.id, event.id).catch(() => {});

    const timeUntil = oneHourBefore > now ? '1 hour' : '15 minutes';

    await sendText(
      user.phone,
      `*Reminder & bookmark set*\n\n` +
        `I'll ping you about *${timeUntil}* before:\n` +
        `*${event.title}*\n` +
        `${formatHumanDate(event.date)}${event.time ? ` · ${formatHumanTime(event.time)}` : ''}\n` +
        `${event.venue_normalized || event.venue || 'TBD'}\n\n` +
        `Add it to your calendar — what device do you use?`
    );

    await sendButtons(user.phone, 'Choose one:', [
      { type: 'reply', reply: { id: `cal_ios_${event.id}`, title: 'iPhone / Apple' } },
      { type: 'reply', reply: { id: `cal_android_${event.id}`, title: 'Android' } },
      { type: 'reply', reply: { id: `cal_both_${event.id}`, title: 'Show both links' } },
    ]);
  } catch (error: any) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      await sendText(user.phone, 'You already have a reminder set for this event!');
    } else {
      console.error('Reminder error:', error.message);
      await sendText(user.phone, "Couldn't set the reminder. Please try again.");
    }
  }
}

/**
 * After user picks iOS / Android / both — send the right calendar URLs.
 */
export async function handleCalendarDeviceReply(user: User, replyId: string): Promise<void> {
  const m = replyId.match(/^cal_(ios|android|both)_(.+)$/i);
  if (!m) {
    return;
  }

  const kind = m[1].toLowerCase();
  const eventId = m[2].trim();

  try {
    const event = await getEventById(eventId);
    if (!event || event.status !== 'confirmed') {
      await sendText(user.phone, '❌ Event not found or no longer active.');
      return;
    }

    const gcal = buildGoogleCalendarUrl(event);
    const appleUrl =
      PUBLIC_BASE_URL.length > 0 ? buildAppleCalendarWebUrl(PUBLIC_BASE_URL, eventId) : null;

    if (kind === 'android') {
      await sendText(
        user.phone,
        `*Google Calendar*\nOpen this link to add the event:\n${gcal}`
      );
    } else if (kind === 'ios') {
      if (appleUrl) {
        await sendText(
          user.phone,
          `*Apple Calendar*\nOpen this link to download the event (.ics). On iPhone, tap the file → *Add*.\n${appleUrl}\n\n` +
            `_Alternative — Google in browser:_\n${gcal}`
        );
      } else {
        await sendText(
          user.phone,
          `*Add to calendar*\n${gcal}\n\n` +
            `_On iPhone: open in Safari → share sheet → Add to Calendar (or open in the Google Calendar app)._ ` +
            `_For a direct .ics link, set PUBLIC_BASE_URL on the server._`
        );
      }
    } else {
      let msg =
        `*Google Calendar*\n${gcal}`;
      if (appleUrl) {
        msg += `\n\n*Apple Calendar (.ics)*\n${appleUrl}`;
      } else {
        msg += `\n\n_(Direct Apple .ics URL unavailable until PUBLIC_BASE_URL is configured.)_`;
      }
      await sendText(user.phone, msg);
    }

    await sendButtons(user.phone, 'What next?', [
      { type: 'reply', reply: { id: 'action_browse_more', title: 'Browse More' } },
      { type: 'reply', reply: { id: 'action_my_saved', title: 'My Saved' } },
    ]);
  } catch (e: any) {
    console.error('Calendar device reply:', e.message);
    await sendText(user.phone, 'Could not build calendar links. Try again later.');
  }
}

/**
 * Show user's pending reminders.
 */
export async function handleViewReminders(user: User): Promise<void> {
  const reminders = await getUserReminders(user.id);

  if (reminders.length === 0) {
    await sendText(
      user.phone,
      'No pending reminders.\n\nBrowse events with /today or /week, then tap Remind to set one!'
    );
    return;
  }

  const lines: string[] = ['*[Your Reminders]*\n'];
  for (const r of reminders) {
    const evt = r.event as any;
    if (evt) {
      lines.push(
        `- [${evt.title}] — ${formatHumanDate(evt.date)}${evt.time ? ` · ${formatHumanTime(evt.time)}` : ''}`
      );
    }
  }

  await sendText(user.phone, lines.join('\n'));
}

async function findEventByIdOrPrefix(idOrPrefix: string): Promise<any> {
  const { getEventById: getById } = await import('../db/supabase.js');
  let event = await getById(idOrPrefix);
  if (event) return event;

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
