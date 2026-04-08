import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { getClubMembers, getClubWithStats, getUserByPhone, updateUser, getEventsByClub, getEventViewCount, getEventSaveCount, getEventReminderCount } from '../db/supabase.js';
import { formatHumanDate } from '../utils/dateParser.js';

/**
 * Handle admin commands: /adduser, /removeuser, /orginfo, /analytics.
 */
export async function handleAdminCommands(user: User, message: WhatsAppMessage): Promise<void> {
  if (!['admin', 'god'].includes(user.role)) {
    await sendText(user.phone, '❌ Admin commands are restricted to club admins.');
    return;
  }

  if (!user.club_id && user.role !== 'god') {
    await sendText(user.phone, '❌ You\'re not linked to a club.');
    return;
  }

  const text = message.text?.body?.trim() || '';
  const textLower = text.toLowerCase();

  if (textLower.startsWith('/adduser ')) {
    await handleAddUser(user, text);
  } else if (textLower.startsWith('/removeuser ')) {
    await handleRemoveUser(user, text);
  } else if (textLower === '/orginfo') {
    await handleOrgInfo(user);
  } else if (textLower === '/analytics') {
    await handleAnalytics(user);
  }
}

async function handleAddUser(admin: User, text: string): Promise<void> {
  const phone = text.replace(/^\/adduser\s*/i, '').trim();

  if (!phone || !phone.startsWith('+')) {
    await sendText(admin.phone, '❌ Please provide a phone number in E.164 format.\n\nUsage: `/adduser +919876543210`');
    return;
  }

  try {
    const targetUser = await getUserByPhone(phone);

    if (!targetUser) {
      await sendText(admin.phone, `❌ User ${phone} hasn't messaged the bot yet. Ask them to send any message first, then try again.`);
      return;
    }

    if (targetUser.club_id) {
      await sendText(admin.phone, `❌ ${phone} is already part of a club.`);
      return;
    }

    await updateUser(targetUser.id, { role: 'power_user', club_id: admin.club_id! } as any);
    await sendText(admin.phone, `✅ Added ${targetUser.name || phone} as a power user!`);
    await sendText(phone, `🎉 You've been added as a power user! You can now post events with /post.`);

  } catch (error: any) {
    console.error('Add user error:', error.message);
    await sendText(admin.phone, '❌ Failed to add user. Please try again.');
  }
}

async function handleRemoveUser(admin: User, text: string): Promise<void> {
  const phone = text.replace(/^\/removeuser\s*/i, '').trim();

  if (!phone) {
    await sendText(admin.phone, '❌ Usage: `/removeuser +919876543210`');
    return;
  }

  try {
    const targetUser = await getUserByPhone(phone);

    if (!targetUser || targetUser.club_id !== admin.club_id) {
      await sendText(admin.phone, '❌ User not found in your club.');
      return;
    }

    if (targetUser.role === 'admin') {
      await sendText(admin.phone, '❌ Can\'t remove the club admin.');
      return;
    }

    await updateUser(targetUser.id, { role: 'user', club_id: null } as any);
    await sendText(admin.phone, `✅ Removed ${targetUser.name || phone} from the club.`);

  } catch (error: any) {
    console.error('Remove user error:', error.message);
    await sendText(admin.phone, '❌ Failed to remove user. Please try again.');
  }
}

async function handleOrgInfo(admin: User): Promise<void> {
  try {
    const club = await getClubWithStats(admin.club_id!);
    if (!club) {
      await sendText(admin.phone, '❌ Club not found.');
      return;
    }

    const members = await getClubMembers(admin.club_id!);

    const lines = [
      `🏛️ *${club.name}* — Org Info\n`,
      `🔑 Invite Code: \`${club.invite_code}\``,
      `📊 ${club.total_events} events posted · ${club.upcoming_events} upcoming`,
      `👀 ${club.total_views} total event views\n`,
      `👥 *Team Members* (${members.length}):`,
    ];

    for (const member of members) {
      const roleLabel = member.role === 'admin' ? '👑 Admin' : '📝 Power User';
      lines.push(`  ${roleLabel} — ${member.name || member.phone}`);
    }

    await sendText(admin.phone, lines.join('\n'));

  } catch (error: any) {
    console.error('Org info error:', error.message);
    await sendText(admin.phone, '❌ Couldn\'t load org info.');
  }
}

async function handleAnalytics(admin: User): Promise<void> {
  try {
    const events = await getEventsByClub(admin.club_id!, false);
    const recent = events.slice(0, 5);

    if (recent.length === 0) {
      await sendText(admin.phone, '📊 No events to show analytics for yet. Post your first event with /post!');
      return;
    }

    const lines = ['📊 *Event Analytics*\n'];

    for (const event of recent) {
      const views = await getEventViewCount(event.id);
      const saves = await getEventSaveCount(event.id);
      const reminders = await getEventReminderCount(event.id);

      lines.push(`🎯 *${event.title}* (${formatHumanDate(event.date)})`);
      lines.push(`   👀 ${views} views · 💾 ${saves} saves · 🔔 ${reminders} reminders`);
      lines.push('');
    }

    await sendText(admin.phone, lines.join('\n'));

  } catch (error: any) {
    console.error('Analytics error:', error.message);
    await sendText(admin.phone, '❌ Couldn\'t load analytics.');
  }
}
