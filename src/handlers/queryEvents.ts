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
        title = cat ? `${cat.label} Events` : `${param} Events`;
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
        // Make the title warm and conversational instead of printing the raw parser intent
        title = result.intent?.length > 25 
          ? "Here's what I found for you" 
          : (result.intent || 'Search Results');
        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1);
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
        ? `Nothing currently matching "${param}".`
        : `No events found.`;

      await sendText(user.phone, noResultMsg);
      // Wait a moment then send the fallback Notification option
      await new Promise(res => setTimeout(res, 500));
      await sendButtons(user.phone, 'Want me to notify you when something comes up?', [
        { type: 'reply', reply: { id: `subscribe_prompt`, title: 'Yes, alert me' } },
        { type: 'reply', reply: { id: `cancel_prompt`, title: 'No thanks' } }
      ]);
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
        { type: 'reply', reply: { id: `remind_${events[0].id}`, title: '🎟️ RSVP / Remind' } },
      ]);
      return;
    }

    // Multiple events — cleanly send list without blasting extra messages
    await sendText(user.phone, formatEventList(events, title));

    // Save the event IDs to the user's conversational state so we can resolve "1", "2", etc.
    const { setConversationState } = await import('../db/supabase.js');
    await setConversationState(user.id, 'viewing_search_results', { 
      events: events.slice(0, 10).map(e => e.id)
    }, 60);

  } catch (error: any) {
    console.error('Query failed:', error.message);
    await sendText(user.phone, 'Something went wrong. Try a simpler query or ask for today\'s events.');
  }
}

/**
 * Show full details for a specific event.
 */
export async function handleEventDetail(user: User, eventId: string): Promise<void> {
  try {
    const event = await getEventById(eventId);

    if (!event) {
      await sendText(user.phone, 'Event not found.');
      return;
    }

    await logEventView(event.id, user.id, 'dm').catch(() => { });
    await sendText(user.phone, formatEventCard(event, (event as any).club));

    if (event.poster_url) {
      await sendImage(user.phone, event.poster_url).catch(() => { });
    }

    await sendButtons(user.phone, 'What would you like to do?', [
      { type: 'reply', reply: { id: `remind_${event.id}`, title: '🎟️ RSVP / Remind' } },
    ]);

  } catch (error: any) {
    console.error('❌ Event detail failed:', error.message);
    await sendText(user.phone, '❌ Couldn\'t load event details. Try again.');
  }
}
