import type { User } from '../types/index.js';
import { sendText, sendButtons, sendImage } from '../services/whatsapp.js';
import { getEventById, getEventsPostedBy, logEventView } from '../db/supabase.js';
import { searchByCommand, searchByKeyword, searchByCategory, searchEvents } from '../services/eventSearch.js';
import { formatEventCard, formatEventList } from '../utils/formatter.js';
import { formatHumanDate } from '../utils/dateParser.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const categoryMap = new Map(categoriesConfig.categories.map(c => [c.slug, c]));

/**
 * Handle all event query commands.
 */
export async function handleQueryEvents(
  user: User,
  queryType: string,
  param?: string
): Promise<void> {
  try {
    let events;
    let title: string;

    switch (queryType) {
      case 'today': {
        events = await searchByCommand('today');
        title = `Events Today`;
        break;
      }
      case 'tomorrow': {
        events = await searchByCommand('tomorrow');
        title = 'Events Tomorrow';
        break;
      }
      case 'this_week': {
        events = await searchByCommand('this_week');
        title = 'Events This Week';
        break;
      }
      case 'this_weekend': {
        events = await searchByCommand('this_weekend');
        title = 'This Weekend';
        break;
      }
      case 'search': {
        events = await searchByKeyword(param || '');
        title = `Search: "${param}"`;
        break;
      }
      case 'category': {
        events = await searchByCategory(param || '');
        const cat = categoryMap.get(param || '');
        title = cat ? `${cat.emoji} ${cat.label} Events` : `${param} Events`;
        break;
      }
      case 'myevents': {
        events = await getEventsPostedBy(user.id);
        title = 'Your Posted Events';
        break;
      }
      case 'natural': {
        // Natural language query via LLM
        const result = await searchEvents(param || '');
        events = result.events;
        title = result.intent || 'Search Results';
        break;
      }
      default: {
        events = await searchByCommand('today');
        title = 'Events Today';
      }
    }

    // Log views
    for (const event of events) {
      await logEventView(event.id, user.id, 'dm').catch(() => { });
    }

    if (events.length === 0) {
      const noResultMsg = queryType === 'natural'
        ? `No events found for "${param}" 😕\n\nTry:\n• /today — today's events\n• /week — this week\n• /clubs — browse clubs`
        : `No events found 😕\n\nTry /week for this week's events or /help for more options.`;

      await sendText(user.phone, noResultMsg);
      return;
    }

    if (events.length === 1) {
      // Single event — show full card
      await sendText(user.phone, formatEventCard(events[0]));

      // Send poster if available
      if (events[0].poster_url) {
        await sendImage(user.phone, events[0].poster_url).catch(() => { });
      }

      // Action buttons
      await sendButtons(user.phone, 'What would you like to do?', [
        { type: 'reply', reply: { id: `save_${events[0].id}`, title: '💾 Save' } },
        { type: 'reply', reply: { id: `remind_${events[0].id}`, title: '🔔 Remind' } },
      ]);
      return;
    }

    // Multiple events — send list
    await sendText(user.phone, formatEventList(events, title));

    // If 3 or fewer, also send action buttons for each
    if (events.length <= 3) {
      for (const event of events) {
        await sendButtons(user.phone, `🎯 *${event.title}*`, [
          { type: 'reply', reply: { id: `view_${event.id}`, title: '👁️ Details' } },
          { type: 'reply', reply: { id: `save_${event.id}`, title: '💾 Save' } },
          { type: 'reply', reply: { id: `remind_${event.id}`, title: '🔔 Remind' } },
        ]);
      }
    }

  } catch (error: any) {
    console.error('❌ Query failed:', error.message);
    await sendText(user.phone, '😅 Something went wrong with that search. Try a simpler query or use /today.');
  }
}

/**
 * Show full details for a specific event.
 */
export async function handleEventDetail(user: User, eventId: string): Promise<void> {
  try {
    const event = await getEventById(eventId);

    if (!event) {
      await sendText(user.phone, '❌ Event not found.');
      return;
    }

    await logEventView(event.id, user.id, 'dm').catch(() => { });
    await sendText(user.phone, formatEventCard(event, (event as any).club));

    if (event.poster_url) {
      await sendImage(user.phone, event.poster_url).catch(() => { });
    }

    await sendButtons(user.phone, 'What would you like to do?', [
      { type: 'reply', reply: { id: `save_${event.id}`, title: '💾 Save' } },
      { type: 'reply', reply: { id: `remind_${event.id}`, title: '🔔 Remind' } },
    ]);

  } catch (error: any) {
    console.error('❌ Event detail failed:', error.message);
    await sendText(user.phone, '❌ Couldn\'t load event details. Try again.');
  }
}
