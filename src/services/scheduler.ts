import cron from 'node-cron';
import { sendText, sendTemplate } from '../services/whatsapp.js';
import {
  getUnbroadcastedEvents,
  queryEvents,
  getPendingReminders,
  markReminderSent,
  expirePastEvents,
  cleanupExpiredStates,
  getSubscribersForCategory,
  supabase,
} from '../db/supabase.js';
import { formatDigest, formatEventCard } from '../utils/formatter.js';
import { getTodayIST, getDateRange, formatHumanDate, formatHumanTime } from '../utils/dateParser.js';
import { WHATSAPP_COMMUNITY_GROUP_ID } from '../config/env.js';

/**
 * Initialize all scheduled jobs.
 */
export function initScheduler(): void {
  console.log('⏰ Initializing scheduler...');

  // Morning digest — 9:00 AM IST daily
  cron.schedule('0 9 * * *', async () => {
    console.log('📨 Running morning digest...');
    await sendDigest('morning');
  }, { timezone: 'Asia/Kolkata' });

  // Evening digest — 6:00 PM IST daily
  cron.schedule('0 18 * * *', async () => {
    console.log('📨 Running evening digest...');
    await sendDigest('evening');
  }, { timezone: 'Asia/Kolkata' });

  // Reminder sender — every minute
  cron.schedule('* * * * *', async () => {
    await sendPendingReminders();
  }, { timezone: 'Asia/Kolkata' });

  // Event expiry — midnight IST
  cron.schedule('0 0 * * *', async () => {
    console.log('🗑️ Running event expiry...');
    const count = await expirePastEvents();
    if (count > 0) console.log(`  Expired ${count} events.`);
  }, { timezone: 'Asia/Kolkata' });

  // Conversation state cleanup — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await cleanupExpiredStates();
  }, { timezone: 'Asia/Kolkata' });

  // Subscriber notifications — every 30 minutes (check for new events matching subscriptions)
  cron.schedule('*/30 * * * *', async () => {
    await notifySubscribers();
  }, { timezone: 'Asia/Kolkata' });

  console.log('✅ Scheduler initialized with 6 cron jobs');
}

/**
 * Send community broadcast digest.
 */
async function sendDigest(type: 'morning' | 'evening'): Promise<void> {
  try {
    const today = getTodayIST();
    const tomorrow = getDateRange('tomorrow');

    // Get events for today + tomorrow that haven't been broadcast
    const events = await getUnbroadcastedEvents();

    // Also get today's events (even if broadcast before — for the evening reminder)
    const todayEvents = await queryEvents({
      dateStart: today,
      dateEnd: today,
      status: 'confirmed',
    });

    const allEvents = type === 'morning'
      ? events // New + today
      : todayEvents.filter(e => {
        // Evening: only events happening tonight (after 5 PM)
        if (!e.time) return true;
        const hour = parseInt(e.time.split(':')[0]);
        return hour >= 17;
      });

    if (allEvents.length === 0) {
      console.log(`  No events for ${type} digest.`);
      return;
    }

    const digestText = formatDigest(allEvents, type);

    // Send to community group if configured
    if (WHATSAPP_COMMUNITY_GROUP_ID) {
      try {
        await sendText(WHATSAPP_COMMUNITY_GROUP_ID, digestText);
        console.log(`  ✅ Digest sent to community (${allEvents.length} events)`);
      } catch (err: any) {
        console.error('  ❌ Community broadcast failed:', err.message);
      }
    }

    // Mark newly broadcast events
    if (events.length > 0) {
      const ids = events.map(e => e.id);
      await supabase
        .from('events')
        .update({ broadcast_sent: true })
        .in('id', ids);
    }

  } catch (error: any) {
    console.error('❌ Digest error:', error.message);
  }
}

/**
 * Send pending reminders.
 */
async function sendPendingReminders(): Promise<void> {
  try {
    const reminders = await getPendingReminders();

    if (reminders.length === 0) return;

    console.log(`🔔 Sending ${reminders.length} reminder(s)...`);

    for (const reminder of reminders) {
      try {
        const event = (reminder as any).event;
        if (!event) {
          await markReminderSent(reminder.id);
          continue;
        }

        const club = event.club;
        const timeStr = event.time ? formatHumanTime(event.time) : 'Soon';
        const venue = event.venue_normalized || event.venue || 'TBD';

        // Try template message first, fall back to regular text
        try {
          await sendTemplate(
            (reminder as any).user?.phone || '',
            'event_reminder',
            'en',
            [event.title, timeStr, venue]
          );
        } catch {
          // Fall back to regular text (within 24hr window)
          const { data: user } = await supabase
            .from('users')
            .select('phone')
            .eq('id', reminder.user_id)
            .single();

          if (user) {
            await sendText(user.phone,
              `⏰ *Reminder!*\n\n` +
              `🎯 *${event.title}* starts soon!\n` +
              `📅 ${formatHumanDate(event.date)} · ⏰ ${timeStr}\n` +
              `📍 ${venue}\n` +
              `${event.registration_link ? `🔗 ${event.registration_link}` : ''}`
            );
          }
        }

        await markReminderSent(reminder.id);

      } catch (err: any) {
        console.error(`  Reminder ${reminder.id} failed:`, err.message);
      }
    }

  } catch (error: any) {
    console.error('❌ Reminder sender error:', error.message);
  }
}

/**
 * Notify subscribers about new events matching their interests.
 */
async function notifySubscribers(): Promise<void> {
  try {
    // Find events posted in the last 30 minutes
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: newEvents } = await supabase
      .from('events')
      .select('*, club:clubs(id, name, slug)')
      .eq('status', 'confirmed')
      .gte('created_at', thirtyMinAgo);

    if (!newEvents || newEvents.length === 0) return;

    for (const event of newEvents) {
      for (const category of event.categories) {
        const subscribers = await getSubscribersForCategory(category);

        for (const subscriber of subscribers) {
          // Don't notify the poster
          if (subscriber.id === event.posted_by) continue;

          try {
            await sendText(subscriber.phone,
              `🔔 New ${category} event!\n\n` +
              formatEventCard(event, event.club)
            );
          } catch {
            // Silently fail for individual notifications
          }
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Subscriber notification error:', error.message);
  }
}
