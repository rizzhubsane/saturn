import type { Event, Club, ClubWithStats, EventLink } from '../types/index.js';
import { formatHumanDate, formatHumanTime } from './dateParser.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const categoryMap = new Map(categoriesConfig.categories.map(c => [c.slug, c]));

// ============================================
// EVENT FORMATTING (V2 — compact, highlights-first)
// ============================================

/**
 * Format a single event as a rich WhatsApp card.
 *
 * Layout:
 *   Title | Top Highlight
 *   Date · Time | Venue | Club
 *   Description
 *   Links
 */
export function formatEventCard(event: Event, club?: Club | null): string {
  const lines: string[] = [];
  const clubName = club?.name || (event as any).club?.name || '';

  // Line 1: Title | Highlight
  const highlightStr = (event.highlights || []).slice(0, 2).join(' · ');
  if (highlightStr) {
    lines.push(`*${event.title}* | ${highlightStr}`);
  } else {
    lines.push(`*${event.title}*`);
  }

  // Line 2: Date · Time | Venue | Club
  const parts: string[] = [];
  const dateTime = formatHumanDate(event.date) + (event.time ? ` · ${formatHumanTime(event.time)}` : '');
  parts.push(dateTime);
  if (event.venue_normalized || event.venue) {
    parts.push(event.venue_normalized || event.venue!);
  }
  if (clubName) {
    parts.push(clubName);
  }
  lines.push(parts.join(' | '));

  // Category tags (compact)
  const categoryTags = event.categories
    .map(slug => {
      const cat = categoryMap.get(slug);
      return cat ? `${cat.emoji || ''}${cat.label}` : `#${slug}`;
    })
    .join('  ');
  if (categoryTags) {
    lines.push(categoryTags);
  }

  lines.push('');

  // Description
  if (event.description) {
    lines.push(event.description);
    lines.push('');
  }

  // Links (all of them)
  const links = event.links || [];
  if (links.length > 0) {
    for (const link of links) {
      const label = link.label === 'register' ? 'Register' :
                    link.label === 'form' ? 'Form' :
                    link.label === 'website' ? 'Website' :
                    link.label === 'instagram' ? 'Instagram' :
                    link.label === 'info' ? 'Info' : 'Link';
      lines.push(`${label}: ${link.url}`);
    }
  } else if (event.registration_link) {
    lines.push(`Register: ${event.registration_link}`);
  }

  return lines.join('\n');
}

/**
 * Format multiple events as a numbered list (compact, highlights visible).
 *
 * Layout per item:
 *   1. Title | Top Highlight
 *      Date · Time | Venue | Club
 */
export function formatEventList(events: Event[], title: string): string {
  if (events.length === 0) {
    return `*${title}*\n\nNo events found.`;
  }

  const lines: string[] = [];
  lines.push(`*${title}* -- ${events.length} found\n`);

  events.slice(0, 10).forEach((event, i) => {
    const timeStr = event.time ? formatHumanTime(event.time) : 'TBD';
    const clubName = (event as any).club?.name || '';
    const venue = event.venue_normalized || event.venue || '';

    // Line 1: number. Title | Highlight
    const highlight = (event.highlights || []).slice(0, 1).join('');
    const titleLine = highlight
      ? `${i + 1}. *${event.title}* | ${highlight}`
      : `${i + 1}. *${event.title}*`;
    lines.push(titleLine);

    // Line 2: Date · Time | Venue | Club
    const meta: string[] = [`${formatHumanDate(event.date)} · ${timeStr}`];
    if (venue) meta.push(venue);
    if (clubName) meta.push(clubName);
    lines.push(`   ${meta.join(' | ')}`);

    lines.push('');
  });

  if (events.length > 10) {
    lines.push(`...and ${events.length - 10} more. Ask me to search specifically.\n`);
  }

  lines.push('_Reply with the number (e.g. 1) for details + RSVP_');

  return lines.join('\n');
}

/**
 * Format parsed event preview for confirmation.
 */
export function formatParsedPreview(parsed: any): string {
  const lines: string[] = [];

  lines.push('*Parsed Event Preview*\n');

  // Title + highlight in one glance
  const highlightStr = (parsed.highlights || []).slice(0, 2).join(' · ');
  if (highlightStr) {
    lines.push(`*${parsed.title}* | ${highlightStr}`);
  } else {
    lines.push(`*${parsed.title}*`);
  }

  // Date/Time
  lines.push(`${formatHumanDate(parsed.date)}${parsed.time ? ` · ${parsed.time}` : ''}`);

  if (parsed.venue) {
    lines.push(`Venue: ${parsed.venue}`);
  }

  // Type + Categories
  if (parsed.event_type && parsed.event_type !== 'other') {
    const cats = (parsed.categories || []).map((slug: string) => {
      const cat = categoryMap.get(slug);
      return cat ? cat.label : slug;
    }).join(' · ');
    lines.push(`Type: ${parsed.event_type}${cats ? ` | ${cats}` : ''}`);
  } else if (parsed.categories?.length > 0) {
    const cats = parsed.categories.map((slug: string) => {
      const cat = categoryMap.get(slug);
      return cat ? cat.label : slug;
    }).join(' · ');
    lines.push(`Tags: ${cats}`);
  }

  if (parsed.description) {
    lines.push(`\n${parsed.description}`);
  }

  // Links
  const links = parsed.links || [];
  if (links.length > 0) {
    lines.push('');
    for (const link of links) {
      lines.push(`${link.label}: ${link.url}`);
    }
  } else if (parsed.registration_link) {
    lines.push(`\nLink: ${parsed.registration_link}`);
  }

  lines.push(`\nConfidence: ${Math.round((parsed.confidence || 0) * 100)}%`);
  lines.push('\nDoes this look right?');

  return lines.join('\n');
}

// ============================================
// CLUB FORMATTING
// ============================================

export function formatClubProfile(club: ClubWithStats): string {
  const cat = categoryMap.get(club.category);
  const lines: string[] = [];

  lines.push(`*${club.name}*`);
  if (cat) lines.push(cat.label);
  lines.push('');

  if (club.tagline) {
    lines.push(`_${club.tagline}_`);
    lines.push('');
  }

  if (club.description) {
    lines.push(club.description);
    lines.push('');
  }

  lines.push('*Engagement*');

  if (club.total_events > 0) {
    const avgViews = Math.round(club.total_views / club.total_events);
    lines.push(`Reach: ${club.total_views} views (~${avgViews}/event)`);
    lines.push(`Intent: ${club.total_saves} saves | ${club.total_reminders} RSVPs`);
  } else {
    lines.push('No events posted yet.');
  }

  lines.push(`\n${club.total_events} total events | ${club.upcoming_events} upcoming`);
  lines.push(`Team: ${club.power_user_count} members`);

  if (club.founded_year) {
    lines.push(`Founded: ${club.founded_year}`);
  }

  const links: string[] = [];
  if (club.website) links.push(`Web: ${club.website}`);
  if (club.instagram) links.push(`IG: @${club.instagram.replace('@', '')}`);
  if (club.linkedin) links.push(`LinkedIn: ${club.linkedin}`);
  if (club.email) links.push(`Email: ${club.email}`);

  if (links.length > 0) {
    lines.push('');
    lines.push(links.join('\n'));
  }

  return lines.join('\n');
}

export function formatClubList(clubs: Club[]): string {
  if (clubs.length === 0) {
    return '*Clubs on Saturn*\n\nNo clubs registered yet.';
  }

  const grouped = new Map<string, Club[]>();
  for (const club of clubs) {
    const key = club.category || 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(club);
  }

  const lines: string[] = [];
  lines.push(`*Clubs on Saturn* -- ${clubs.length} registered\n`);

  for (const [category, categoryClubs] of grouped) {
    const cat = categoryMap.get(category);
    lines.push(`*${cat?.label || category}*`);
    for (const club of categoryClubs) {
      lines.push(`- ${club.name}${club.tagline ? ` -- _${club.tagline}_` : ''}`);
    }
    lines.push('');
  }

  lines.push('Use /club <name> to see a club profile and upcoming events.');

  return lines.join('\n');
}

// ============================================
// DIGEST FORMATTING (V2 — time-of-day grouped, highlights visible)
// ============================================

export function formatDigest(events: Event[], digestType: 'morning' | 'evening'): string {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });

  const lines: string[] = [];

  if (digestType === 'morning') {
    lines.push(`*Saturn Daily* | ${dateStr}\n`);
  } else {
    lines.push(`*Tonight on Campus* | ${dateStr}\n`);
  }

  // Group events by time-of-day
  const grouped = groupByTimeOfDay(events);

  for (const [period, periodEvents] of grouped) {
    if (periodEvents.length === 0) continue;

    lines.push(`-- ${period.toUpperCase()} --\n`);

    for (const event of periodEvents) {
      const timeStr = event.time ? formatHumanTime(event.time) : 'TBD';
      const clubName = (event as any).club?.name || '';
      const venue = event.venue_normalized || event.venue || '';
      const highlight = (event.highlights || []).slice(0, 1).join('');

      // Compact: Title | Highlight
      if (highlight) {
        lines.push(`*${event.title}* | ${highlight}`);
      } else {
        lines.push(`*${event.title}*`);
      }

      // Time | Venue | Club
      const meta: string[] = [timeStr];
      if (venue) meta.push(venue);
      if (clubName) meta.push(clubName);
      lines.push(meta.join(' | '));
      lines.push('');
    }
  }

  lines.push(`${events.length} event${events.length !== 1 ? 's' : ''} today. DM me for details + RSVP`);

  return lines.join('\n');
}

function groupByTimeOfDay(events: Event[]): Map<string, Event[]> {
  const groups = new Map<string, Event[]>([
    ['morning', []],
    ['afternoon', []],
    ['evening', []],
    ['all day', []],
  ]);

  for (const event of events.slice(0, 15)) {
    if (!event.time) {
      groups.get('all day')!.push(event);
      continue;
    }
    const hour = parseInt(event.time.split(':')[0]);
    if (hour < 12) {
      groups.get('morning')!.push(event);
    } else if (hour < 17) {
      groups.get('afternoon')!.push(event);
    } else {
      groups.get('evening')!.push(event);
    }
  }

  return groups;
}

// ============================================
// HELP FORMATTING (V2 — fully differentiated per role)
// ============================================

export function formatHelp(role: string): string {
  switch (role) {
    case 'god':
      return formatGodHelp();
    case 'admin':
      return formatAdminHelp();
    case 'power_user':
      return formatPowerUserHelp();
    default:
      return formatStudentHelp();
  }
}

function formatStudentHelp(): string {
  return [
    '*Saturn* -- Your Campus Event Assistant\n',
    'Just ask me anything in plain English:\n',
    '"What\'s happening today?"',
    '"Any hackathons this week?"',
    '"Show me cultural events"',
    '"Is there a coding club?"\n',
    '*Quick Filters*',
    '/today /tomorrow /week /weekend\n',
    '*Your Stuff*',
    '/saved -- your bookmarked events',
    '/mysubs -- your notification preferences\n',
    '*Discover*',
    '/clubs -- browse all campus clubs',
    '/club <name> -- see a club\'s profile\n',
    '_Tip: After I show events, reply with the number (e.g. 1) to see details and RSVP._',
  ].join('\n');
}

function formatPowerUserHelp(): string {
  return [
    '*Saturn* -- Club Team Dashboard\n',
    '*Post Events*',
    '/post -- publish an event (text + poster)',
    '/myevents -- your posted events\n',
    '*Your Club*',
    '/clubinfo -- club profile + analytics',
    '/editclub -- update club details\n',
    '*Discover*',
    '/today /tomorrow /week -- browse events',
    '/clubs -- see all clubs',
    '/saved -- your bookmarked events\n',
    '_Just ask me anything in plain English too._',
  ].join('\n');
}

function formatAdminHelp(): string {
  return [
    '*Saturn* -- Club Admin Panel\n',
    '*Manage Team*',
    '/adduser <phone> -- add a team member',
    '/removeuser <phone> -- remove a member',
    '/orginfo -- team overview\n',
    '*Post & Track*',
    '/post -- publish an event',
    '/myevents -- your posted events',
    '/analytics -- engagement stats\n',
    '*Club Profile*',
    '/clubinfo -- view your club dashboard',
    '/editclub -- update club details\n',
    '*Discover*',
    '/today /tomorrow /week -- browse events',
    '/clubs -- see all clubs',
    '/saved -- your bookmarks\n',
    '_Share your invite code with team members so they can /join._',
  ].join('\n');
}

function formatGodHelp(): string {
  return [
    '*Saturn* -- God Mode\n',
    '*System*',
    '/stats -- system-wide stats',
    '/broadcast <msg> -- message all users',
    '/digest -- test community digest now',
    '/purge -- cleanup\n',
    '*Manage*',
    '/addorg <name> -- register a club',
    '/promote <phone> admin <club> -- promote user\n',
    '*Regular*',
    '/post /myevents /clubinfo /editclub',
    '/adduser /removeuser /orginfo /analytics',
    '/today /tomorrow /week /clubs /saved',
  ].join('\n');
}
