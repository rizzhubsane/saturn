import type { Event, Club, ClubWithStats } from '../types/index.js';
import { formatHumanDate, formatHumanTime } from './dateParser.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const categoryMap = new Map(categoriesConfig.categories.map(c => [c.slug, c]));

// ============================================
// EVENT FORMATTING
// ============================================

/**
 * Format a single event as a rich WhatsApp card.
 */
export function formatEventCard(event: Event, club?: Club | null): string {
  const categoryTags = event.categories
    .map(slug => {
      const cat = categoryMap.get(slug);
      return cat ? cat.label : `#${slug}`;
    })
    .join(' · ');

  const lines: string[] = [];

  lines.push(`*[${event.title}]*`);
  lines.push(`Date: ${formatHumanDate(event.date)}${event.time ? ` · Time: ${formatHumanTime(event.time)}` : ''}`);
  
  if (event.venue) {
    lines.push(`Location: ${event.venue_normalized || event.venue}`);
  }

  if (categoryTags) {
    lines.push(`Tags: ${categoryTags}`);
  }

  lines.push('');

  if (event.description) {
    lines.push(event.description);
    lines.push('');
  }

  if (event.registration_link) {
    lines.push(`Register: ${event.registration_link}`);
  }

  if (club) {
    lines.push(`Organised by: ${club.name}`);
  } else if ((event as any).club) {
    lines.push(`Organised by: ${(event as any).club.name}`);
  }

  return lines.join('\n');
}

/**
 * Format multiple events as a numbered list (compact).
 */
export function formatEventList(events: Event[], title: string): string {
  if (events.length === 0) {
    return `*[${title}]*\n\nNo events found.`;
  }

  const lines: string[] = [];
  lines.push(`*[${title}]* — ${events.length} found\n`);

  events.slice(0, 10).forEach((event, i) => {
    const timeStr = event.time ? formatHumanTime(event.time) : 'TBD';
    const clubName = (event as any).club?.name || '';
    const venue = event.venue_normalized || event.venue || '';

    lines.push(`${i + 1}. *${event.title}*`);
    lines.push(`   Date: ${formatHumanDate(event.date)} · Time: ${timeStr}${venue ? `\n   Location: ${venue}` : ''}`);
    if (clubName) {
      lines.push(`   By: ${clubName}`);
    }
    lines.push('');
  });

  if (events.length > 10) {
    lines.push(`... and ${events.length - 10} more. Ask me to search specifically.`);
  }

  return lines.join('\n');
}

/**
 * Format parsed event preview for confirmation.
 */
export function formatParsedPreview(parsed: any): string {
  const lines: string[] = [];

  lines.push('*[Parsed Event Details]*\n');
  lines.push(`Title: *${parsed.title}*`);
  lines.push(`Date: ${formatHumanDate(parsed.date)}${parsed.time ? ` · Time: ${parsed.time}` : ''}`);

  if (parsed.venue) {
    lines.push(`Location: ${parsed.venue}`);
  }

  if (parsed.categories?.length > 0) {
    const cats = parsed.categories.map((slug: string) => {
      const cat = categoryMap.get(slug);
      return cat ? cat.label : slug;
    }).join(' · ');
    lines.push(`Tags: ${cats}`);
  }

  if (parsed.description) {
    lines.push(`\nDescription:\n${parsed.description}`);
  }

  if (parsed.registration_link) {
    lines.push(`\nLinks: ${parsed.registration_link}`);
  }

  lines.push(`\nConfidence: ${Math.round((parsed.confidence || 0) * 100)}%`);
  lines.push('\nDoes this look right?');

  return lines.join('\n');
}

// ============================================
// CLUB FORMATTING
// ============================================

/**
 * Format a full club profile card.
 */
export function formatClubProfile(club: ClubWithStats): string {
  const cat = categoryMap.get(club.category);
  const lines: string[] = [];

  lines.push(`*[${club.name}]*`);
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

  lines.push(`${club.total_events} events posted · ${club.upcoming_events} upcoming`);
  lines.push(`${club.total_views} total views · ${club.power_user_count} team members`);

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

/**
 * Format club list grouped by category.
 */
export function formatClubList(clubs: Club[]): string {
  if (clubs.length === 0) {
    return '*[Clubs on Saturn]*\n\nNo clubs registered yet.';
  }

  const grouped = new Map<string, Club[]>();
  for (const club of clubs) {
    const key = club.category || 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(club);
  }

  const lines: string[] = [];
  lines.push(`*[Clubs on Saturn]* — ${clubs.length} registered\n`);

  for (const [category, categoryClubs] of grouped) {
    const cat = categoryMap.get(category);
    lines.push(`*[${cat?.label || category}]*`);
    for (const club of categoryClubs) {
      lines.push(`- ${club.name}${club.tagline ? ` — _${club.tagline}_` : ''}`);
    }
    lines.push('');
  }

  lines.push('Use /club <name> to see a club profile and upcoming events.');

  return lines.join('\n');
}

// ============================================
// DIGEST FORMATTING
// ============================================

/**
 * Format community broadcast digest.
 */
export function formatDigest(events: Event[], digestType: 'morning' | 'evening'): string {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const lines: string[] = [];

  if (digestType === 'morning') {
    lines.push(`🌅 *Morning Events Update* — ${dateStr}\n`);
  } else {
    lines.push(`🌙 *Evening Events Update* — ${dateStr}\n`);
  }

  events.slice(0, 10).forEach(event => {
    const timeStr = event.time ? formatHumanTime(event.time) : 'TBD';
    const clubName = (event as any).club?.name || '';
    const venue = event.venue_normalized || event.venue || '';

    const urlEncodedTitle = encodeURIComponent(event.title);
    const waLink = `wa.me/917065526258?text=tell+me+about+${urlEncodedTitle}`;

    lines.push(`🎯 *${event.title}*`);
    lines.push(`   Time: ${timeStr}${venue ? `\n   📍 ${venue}` : ''}`);
    if (clubName) lines.push(`   By: ${clubName}`);
    lines.push(`   🔗 Info: ${waLink}`);
    lines.push('');
  });

  if (events.length > 10) {
    lines.push(`${events.length - 10} more events — talk to me to see all!`);
  }
  
  lines.push('\n💬 _Ask me for reminders or search events!_');

  return lines.join('\n');
}

// ============================================
// HELP FORMATTING
// ============================================

/**
 * Format role-aware help message.
 */
export function formatHelp(role: string): string {
  const lines: string[] = [];

  lines.push('*[Saturn]* — IIT Delhi Event Assistant\n');
  lines.push('I can help you find events on campus. Just talk to me naturally!\n');

  lines.push('Examples:');
  lines.push('- "What\'s happening today?"');
  lines.push('- "Are there any tech events this week?"');
  lines.push('- "Show me my saved events"');
  lines.push('');
  if (['power_user', 'admin', 'god'].includes(role)) {
    lines.push('Power User Commands:');
    lines.push('- /post (or forward a poster and write /post)');
    lines.push('- /myevents');
    lines.push('- /clubinfo');
    lines.push('');
  }
  if (['admin', 'god'].includes(role)) {
    lines.push('Admin Commands:');
    lines.push('- /adduser <phone>');
    lines.push('- /removeuser <phone>');
    lines.push('- /editclub');
    lines.push('- /analytics');
    lines.push('');
  }
  if (role === 'god') {
    lines.push('God Mode:');
    lines.push('- /addorg <name>');
    lines.push('- /promote <phone> admin <club>');
    lines.push('- /broadcast <msg>');
    lines.push('- /stats');
    lines.push('- /purge');
  }

  return lines.join('\n');
}
