import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { GOD_PHONE } from '../config/env.js';
import { createClub, updateUser, getUserByPhone, getSystemStats, expirePastEvents, supabase } from '../db/supabase.js';
import { generateInviteCode } from '../utils/inviteCode.js';

/**
 * Handle god-level commands.
 */
export async function handleGodCommands(user: User, message: WhatsAppMessage): Promise<void> {
  if (user.role !== 'god') {
    await sendText(user.phone, '❌ Restricted.');
    return;
  }

  const text = message.text?.body?.trim() || '';
  const textLower = text.toLowerCase();

  if (textLower.startsWith('/addorg ')) {
    await handleAddOrg(user, text);
  } else if (textLower.startsWith('/promote ')) {
    await handlePromote(user, text);
  } else if (textLower.startsWith('/broadcast ')) {
    await handleBroadcast(user, text);
  } else if (textLower === '/stats') {
    await handleStats(user);
  } else if (textLower === '/purge') {
    await handlePurge(user);
  } else if (textLower === '/digesttest') {
    await handleTestDigest(user);
  }
}

async function handleAddOrg(user: User, text: string): Promise<void> {
  const clubName = text.replace(/^\/addorg\s*/i, '').trim();

  if (!clubName) {
    await sendText(user.phone, 'Usage: `/addorg <club name>`');
    return;
  }

  const slug = clubName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const inviteCode = await generateInviteCode();

  try {
    const club = await createClub({
      name: clubName,
      slug,
      invite_code: inviteCode,
      admin_phone: user.phone,
      category: 'other',
      status: 'active',
    } as any);

    await sendText(user.phone,
      `✅ *${clubName}* created.\n` +
      `🔑 Invite: \`${inviteCode}\`\n` +
      `📎 Slug: ${slug}\n` +
      `🆔 ID: ${club.id.substring(0, 8)}`
    );
  } catch (error: any) {
    await sendText(user.phone, `❌ Error: ${error.message}`);
  }
}

async function handlePromote(user: User, text: string): Promise<void> {
  // /promote +91... admin ClubName
  const parts = text.replace(/^\/promote\s*/i, '').trim().split(/\s+/);

  if (parts.length < 3) {
    await sendText(user.phone, 'Usage: `/promote <phone> admin <club_name>`');
    return;
  }

  const phone = parts[0];
  const role = parts[1]; // 'admin' or 'power_user'
  const clubName = parts.slice(2).join(' ');

  try {
    const targetUser = await getUserByPhone(phone);
    if (!targetUser) {
      await sendText(user.phone, `❌ ${phone} hasn't messaged the bot yet.`);
      return;
    }

    // Find club
    const { getClubByName } = await import('../db/supabase.js');
    const club = await getClubByName(clubName);
    if (!club) {
      await sendText(user.phone, `❌ Club "${clubName}" not found.`);
      return;
    }

    await updateUser(targetUser.id, { role: role as any, club_id: club.id } as any);

    // Update club admin phone if promoting to admin
    if (role === 'admin') {
      const { updateClub } = await import('../db/supabase.js');
      await updateClub(club.id, { admin_phone: phone } as any);
    }

    await sendText(user.phone, `✅ ${targetUser.name || phone} is now ${role} of *${club.name}*.`);
    await sendText(phone, `🎉 You've been promoted to ${role} of *${club.name}*! Type /help to see your commands.`);

  } catch (error: any) {
    await sendText(user.phone, `❌ Error: ${error.message}`);
  }
}

async function handleBroadcast(user: User, text: string): Promise<void> {
  const broadcastMsg = text.replace(/^\/broadcast\s*/i, '').trim();

  if (!broadcastMsg) {
    await sendText(user.phone, 'Usage: `/broadcast <message>`');
    return;
  }

  try {
    // Get all users
    const { data: users } = await supabase.from('users').select('phone').neq('phone', user.phone);

    if (!users || users.length === 0) {
      await sendText(user.phone, 'No users to broadcast to.');
      return;
    }

    await sendText(user.phone, `📡 Broadcasting to ${users.length} users...`);

    let sent = 0;
    let failed = 0;

    for (const u of users) {
      try {
        await sendText(u.phone, `📢 *System Announcement*\n\n${broadcastMsg}`);
        sent++;
      } catch {
        failed++;
      }
      // Rate limit: slight delay between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await sendText(user.phone, `✅ Broadcast complete. Sent: ${sent}, Failed: ${failed}`);

  } catch (error: any) {
    await sendText(user.phone, `❌ Broadcast failed: ${error.message}`);
  }
}

async function handleStats(user: User): Promise<void> {
  try {
    const stats = await getSystemStats();

    const conversionRate = stats.totalViews > 0 
      ? Math.round(((stats.totalSaves + stats.totalReminders) / stats.totalViews) * 100) 
      : 0;

    await sendText(user.phone,
      `📊 *Saturn Global Health* 📊\n\n` +
      `*Ecosystem*\n` +
      `👥 Users: ${stats.totalUsers}\n` +
      `🏛️ Clubs: ${stats.totalClubs}\n` +
      `📅 Events: ${stats.totalEvents} (Active: ${stats.activeEvents})\n\n` +
      `*Engagement Funnel*\n` +
      `👀 Total Reach: ${stats.totalViews} views\n` +
      `🔖 Bookmarks (Saves): ${stats.totalSaves}\n` +
      `🔔 Active RSVPs (Reminders): ${stats.totalReminders}\n\n` +
      `🚀 *Conv. Rate:* ~${conversionRate}% (Views to Bookmarks/RSVPs)`
    );

  } catch (error: any) {
    await sendText(user.phone, `❌ Stats error: ${error.message}`);
  }
}

async function handlePurge(user: User): Promise<void> {
  try {
    const count = await expirePastEvents();
    await sendText(user.phone, `Purged ${count} expired events.`);
  } catch (error: any) {
    await sendText(user.phone, `Purge error: ${error.message}`);
  }
}

async function handleTestDigest(user: User): Promise<void> {
  try {
    const { formatDigest } = await import('../utils/formatter.js');
    const { queryEvents: dbQueryEvents, getUnbroadcastedEvents } = await import('../db/supabase.js');
    const { getTodayIST } = await import('../utils/dateParser.js');

    const today = getTodayIST();

    const [todayEvents, unbroadcasted] = await Promise.all([
      dbQueryEvents({ dateStart: today, dateEnd: today, status: 'confirmed' }),
      getUnbroadcastedEvents(),
    ]);

    const allEvents = [...todayEvents, ...unbroadcasted.filter(e => e.date !== today)];
    // Dedupe by ID
    const seen = new Set<string>();
    const unique = allEvents.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    if (unique.length === 0) {
      await sendText(user.phone, '*Digest Test*\n\nNo events to include. Post some events first.');
      return;
    }

    const morningDigest = formatDigest(unique, 'morning');
    const eveningDigest = formatDigest(
      unique.filter(e => {
        if (!e.time) return true;
        const hour = parseInt(e.time.split(':')[0]);
        return hour >= 17;
      }),
      'evening'
    );

    await sendText(user.phone, `*-- MORNING DIGEST PREVIEW --*\n\n${morningDigest}`);
    await new Promise(r => setTimeout(r, 500));
    await sendText(user.phone, `*-- EVENING DIGEST PREVIEW --*\n\n${eveningDigest}`);
  } catch (error: any) {
    await sendText(user.phone, `Digest test error: ${error.message}`);
  }
}
