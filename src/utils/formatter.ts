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
      return cat ? `${cat.emoji} ${cat.label}` : `#${slug}`;
    })
    .join(' · ');

  const lines: string[] = [];

  lines.push(`🎯 *${event.title}*`);
  lines.push(`📅 ${formatHumanDate(event.date)}${event.time ? ` · ⏰ ${formatHumanTime(event.time)}` : ''}`);
  
  if (event.venue) {
    lines.push(`📍 ${event.venue_normalized || event.venue}`);
  }

  if (categoryTags) {
    lines.push(`🏷️ ${categoryTags}`);
  }

  lines.push('');

  if (event.description) {
    lines.push(event.description);
    lines.push('');
  }

  if (event.registration_link) {
    lines.push(`🔗 Register: ${event.registration_link}`);
  }

  if (club) {
    lines.push(`🏢 ${club.name}`);
  } else if ((event as any).club) {
    lines.push(`🏢 ${(event as any).club.name}`);
  }

  lines.push('');
  lines.push(`💾 /save ${event.id.substring(0, 8)} — Save this event`);
  lines.push(`🔔 /remind ${event.id.substring(0, 8)} — Set a reminder`);

  return lines.join('\n');
}

/**
 * Format multiple events as a numbered list (compact).
 */
export function formatEventList(events: Event[], title: string): string {
  if (events.length === 0) {
    return `📋 *${title}*\n\nNo events found 😕`;
  }

  const lines: string[] = [];
  lines.push(`📋 *${title}* — ${events.length} found\n`);

  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  events.slice(0, 10).forEach((event, i) => {
    const timeStr = event.time ? formatHumanTime(event.time) : 'TBD';
    const clubName = (event as any).club?.name || '';
    const venue = event.venue_normalized || event.venue || '';

    lines.push(`${emojis[i] || `${i + 1}.`} *${event.title}*`);
    lines.push(`   📅 ${formatHumanDate(event.date)} · ⏰ ${timeStr}${venue ? ` · 📍 ${venue}` : ''}`);
    if (clubName) {
      lines.push(`   🏢 ${clubName}`);
    }
    lines.push('');
  });

  if (events.length > 10) {
    lines.push(`... and ${events.length - 10} more. Use /search to narrow down.`);
  }

  lines.push('Reply with event number for full details!');

  return lines.join('\n');
}

/**
 * Format parsed event preview for confirmation.
 */
export function formatParsedPreview(parsed: any): string {
  const lines: string[] = [];

  lines.push('📋 *Here\'s what I parsed:*\n');
  lines.push(`🎤 *${parsed.title}*`);
  lines.push(`📅 ${formatHumanDate(parsed.date)}${parsed.time ? ` · ${parsed.time}` : ''}`);

  if (parsed.venue) {
    lines.push(`📍 ${parsed.venue}`);
  }

  if (parsed.categories?.length > 0) {
    const cats = parsed.categories.map((slug: string) => {
      const cat = categoryMap.get(slug);
      return cat ? cat.label : slug;
    }).join(' · ');
    lines.push(`🏷️ ${cats}`);
  }

  if (parsed.description) {
    lines.push(`📝 ${parsed.description}`);
  }

  if (parsed.registration_link) {
    lines.push(`🔗 ${parsed.registration_link}`);
  }

  lines.push(`\n🎯 Confidence: ${Math.round((parsed.confidence || 0) * 100)}%`);
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

  lines.push(`🏛️ *${club.name}*`);
  if (cat) lines.push(`${cat.emoji} ${cat.label}`);
  lines.push('');

  if (club.tagline) {
    lines.push(`_${club.tagline}_`);
    lines.push('');
  }

  if (club.description) {
    lines.push(club.description);
    lines.push('');
  }

  lines.push(`📊 ${club.total_events} events posted · ${club.upcoming_events} upcoming`);
  lines.push(`👀 ${club.total_views} total views · 👥 ${club.power_user_count} team members`);

  if (club.founded_year) {
    lines.push(`📅 Founded: ${club.founded_year}`);
  }

  const links: string[] = [];
  if (club.website) links.push(`🌐 ${club.website}`);
  if (club.instagram) links.push(`📸 @${club.instagram.replace('@', '')}`);
  if (club.linkedin) links.push(`💼 ${club.linkedin}`);
  if (club.email) links.push(`📧 ${club.email}`);

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
    return '🏛️ *Clubs on EventX*\n\nNo clubs registered yet.';
  }

  const grouped = new Map<string, Club[]>();
  for (const club of clubs) {
    const key = club.category || 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(club);
  }

  const lines: string[] = [];
  lines.push(`🏛️ *Clubs on EventX* — ${clubs.length} registered\n`);

  for (const [category, categoryClubs] of grouped) {
    const cat = categoryMap.get(category);
    lines.push(`${cat?.emoji || '📌'} *${cat?.label || category}*`);
    for (const club of categoryClubs) {
      lines.push(`  → ${club.name}${club.tagline ? ` — _${club.tagline}_` : ''}`);
    }
    lines.push('');
  }

  lines.push('Use /club <name> to see a club\'s full profile and upcoming events.');

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
    lines.push(`📅 *Good Morning! Events Update* — ${dateStr}\n`);
  } else {
    lines.push(`🌙 *Evening Events Update* — ${dateStr}\n`);
  }

  events.slice(0, 10).forEach(event => {
    const timeStr = event.time ? formatHumanTime(event.time) : 'TBD';
    const clubName = (event as any).club?.name || '';
    const venue = event.venue_normalized || event.venue || '';

    lines.push(`🎯 *${event.title}*`);
    lines.push(`  ⏰ ${timeStr}${venue ? ` · 📍 ${venue}` : ''}`);
    if (clubName) lines.push(`  🏢 ${clubName}`);
    if (event.registration_link) lines.push(`  🔗 ${event.registration_link}`);
    lines.push('  ─────────────────────');
  });

  if (events.length > 10) {
    lines.push(`\n📌 ${events.length - 10} more events — DM me to see all!`);
  }

  lines.push('\n💬 *Want personalized event updates? DM me!*');

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

  lines.push('🤖 *EventX — IIT Delhi Event Discovery Bot*\n');
  lines.push('Here\'s what I can do:\n');

  // User commands (everyone)
  lines.push('📋 *Discover Events*');
  lines.push('  /today — What\'s happening today');
  lines.push('  /tomorrow — Tomorrow\'s events');
  lines.push('  /week — This week\'s lineup');
  lines.push('  /search <keyword> — Search events');
  lines.push('  /clubs — Browse all clubs');
  lines.push('  /club <name> — Club profile & events');
  lines.push('');
  lines.push('💡 *You can also ask naturally:*');
  lines.push('  "any hackathons this week?"');
  lines.push('  "what\'s happening tonight?"');
  lines.push('');
  lines.push('🔔 *Personalize*');
  lines.push('  /save <id> — Save an event');
  lines.push('  /saved — View saved events');
  lines.push('  /remind <id> — Set a reminder');
  lines.push('  /subscribe <category> — Daily digest');
  lines.push('  /unsubscribe <category> — Stop digest');

  // Power User commands
  if (['power_user', 'admin', 'god'].includes(role)) {
    lines.push('');
    lines.push('📝 *Post Events* (Power User)');
    lines.push('  /post — Post a new event');
    lines.push('  /myevents — Your posted events');
    lines.push('  /clubinfo — Your club\'s profile & stats');
  }

  // Admin commands
  if (['admin', 'god'].includes(role)) {
    lines.push('');
    lines.push('⚙️ *Club Admin*');
    lines.push('  /adduser <phone> — Add team member');
    lines.push('  /removeuser <phone> — Remove member');
    lines.push('  /editclub — Edit club profile');
    lines.push('  /analytics — Event analytics');
  }

  // God commands
  if (role === 'god') {
    lines.push('');
    lines.push('👑 *God Mode*');
    lines.push('  /addorg <name> — Register a club');
    lines.push('  /promote <phone> admin <club> — Make admin');
    lines.push('  /broadcast <msg> — Message all users');
    lines.push('  /stats — System stats');
    lines.push('  /purge — Expire past events');
  }

  // Registration
  if (role === 'user') {
    lines.push('');
    lines.push('🏛️ *For Club Leaders*');
    lines.push('  /register <club name> — Register your club');
    lines.push('  /join <invite code> — Join as team member');
  }

  return lines.join('\n');
}
