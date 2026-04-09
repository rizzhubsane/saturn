import type { User } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { getAllActiveClubs, getClubBySlug, getClubByName, getClubWithStats, getEventsByClub } from '../db/supabase.js';
import { formatClubList, formatClubProfile, formatEventList } from '../utils/formatter.js';
import type { Club } from '../types/index.js';

/**
 * Handle /clubs — list all clubs, optionally filtered by category.
 */
export async function handleClubDiscovery(user: User, category?: string): Promise<void> {
  try {
    let clubs = await getAllActiveClubs();

    if (category) {
      const slug = category.toLowerCase().trim();
      clubs = clubs.filter(c => c.category === slug);

      if (clubs.length === 0) {
        await sendText(user.phone, `No clubs found in the "${category}" category.\n\nUse /clubs to see all clubs.`);
        return;
      }
    }

    await sendText(user.phone, formatClubList(clubs));

    await sendButtons(user.phone, 'Want to see events instead?', [
      { type: 'reply', reply: { id: 'action_today', title: 'Today\'s Events' } },
      { type: 'reply', reply: { id: 'action_this_week', title: 'This Week' } },
    ]);

  } catch (error: any) {
    console.error('Club discovery error:', error.message);
    await sendText(user.phone, 'Couldn\'t load clubs. Please try again.');
  }
}

/**
 * Handle /club <name> — show a specific club's profile and upcoming events.
 */
export async function handleClubDetail(user: User, clubName: string): Promise<void> {
  try {
    // Try by slug first, then by name
    let club = await getClubBySlug(clubName.toLowerCase().replace(/\s+/g, '-'));
    if (!club) {
      club = await getClubByName(clubName);
    }

    // Fuzzy match if exact not found
    if (!club) {
      const allClubs = await getAllActiveClubs();
      club = allClubs.find(c =>
        c.name.toLowerCase().includes(clubName.toLowerCase()) ||
        c.slug.includes(clubName.toLowerCase().replace(/\s+/g, '-'))
      ) || null;
    }

    if (!club) {
      await sendText(user.phone, `❌ No club found matching "${clubName}".\n\nUse /clubs to see all registered clubs.`);
      return;
    }

    // Get full profile with stats
    const clubWithStats = await getClubWithStats(club.id);
    if (!clubWithStats) {
      await sendText(user.phone, '❌ Club not found.');
      return;
    }

    await sendText(user.phone, formatClubProfile(clubWithStats));

    // Show upcoming events
    const events = await getEventsByClub(club.id, true);
    if (events.length > 0) {
      await sendText(user.phone, formatEventList(events, `Upcoming from ${club.name}`));
    } else {
      await sendText(user.phone, `\n📅 No upcoming events from *${club.name}* right now.`);
    }

  } catch (error: any) {
    console.error('❌ Club detail error:', error.message);
    await sendText(user.phone, '❌ Couldn\'t load club details. Please try again.');
  }
}
