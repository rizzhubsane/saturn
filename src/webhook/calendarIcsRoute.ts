import type { Request, Response } from 'express';
import { getEventById } from '../db/supabase.js';
import { buildIcsContent } from '../utils/calendarLinks.js';

/**
 * GET /calendar/ics/:eventId — download .ics for Apple Calendar / Outlook (public; id is unguessable UUID).
 */
export async function handleCalendarIcsRoute(req: Request, res: Response): Promise<void> {
  const eventId = req.params.eventId;
  if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
    res.status(400).type('text/plain').send('Invalid event id');
    return;
  }

  try {
    const event = await getEventById(eventId);
    if (!event || event.status !== 'confirmed') {
      res.status(404).type('text/plain').send('Event not found');
      return;
    }

    const ics = buildIcsContent(event);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="event-${eventId.slice(0, 8)}.ics"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(ics);
  } catch (e: any) {
    console.error('calendar ICS error:', e.message);
    res.status(500).type('text/plain').send('Server error');
  }
}
