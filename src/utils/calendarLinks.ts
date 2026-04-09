import type { Event } from '../types/index.js';

/**
 * Build local Date for event in IST (same as reminders handler).
 */
export function buildEventDateTime(dateStr: string, timeStr: string | null): Date {
  if (timeStr) {
    return new Date(`${dateStr}T${timeStr}+05:30`);
  }
  return new Date(`${dateStr}T09:00:00+05:30`);
}

function formatUtcIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/**
 * Google Calendar “add event” template URL (works in browser on Android & iOS).
 */
export function buildGoogleCalendarUrl(event: Event): string {
  const startObj = buildEventDateTime(event.date, event.time);
  const endObj = event.end_time
    ? buildEventDateTime(event.date, event.end_time)
    : new Date(startObj.getTime() + 2 * 60 * 60 * 1000);

  const startDate = formatUtcIcs(startObj);
  const endDate = formatUtcIcs(endObj);

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.append('action', 'TEMPLATE');
  url.searchParams.append('text', event.title);
  url.searchParams.append('dates', `${startDate}/${endDate}`);
  const venue = event.venue_normalized || event.venue;
  if (venue) url.searchParams.append('location', venue);

  return url.toString();
}

/**
 * RFC 5545 ICS document for Apple Calendar and other clients.
 */
export function buildIcsContent(event: Event): string {
  const startObj = buildEventDateTime(event.date, event.time);
  const endObj = event.end_time
    ? buildEventDateTime(event.date, event.end_time)
    : new Date(startObj.getTime() + 2 * 60 * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Saturn IITD//Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@saturn-iitd`,
    `DTSTAMP:${formatUtcIcs(new Date())}`,
    `DTSTART:${formatUtcIcs(startObj)}`,
    `DTEND:${formatUtcIcs(endObj)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  const venue = event.venue_normalized || event.venue;
  if (venue) {
    lines.push(`LOCATION:${escapeIcsText(venue)}`);
  }
  if (event.description) {
    const desc = event.description.length > 800 ? event.description.slice(0, 797) + '…' : event.description;
    lines.push(`DESCRIPTION:${escapeIcsText(desc)}`);
  }
  if (event.registration_link) {
    lines.push(`URL:${event.registration_link}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

/** Public HTTPS URL to download ICS (Apple Calendar / iOS). */
export function buildAppleCalendarWebUrl(baseUrl: string, eventId: string): string {
  const b = baseUrl.replace(/\/$/, '');
  return `${b}/calendar/ics/${eventId}`;
}
