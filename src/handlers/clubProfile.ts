import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { getClubWithStats, updateClub, setConversationState, clearConversationState } from '../db/supabase.js';
import { formatClubProfile } from '../utils/formatter.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

/**
 * Handle /clubinfo — show club profile and stats.
 */
export async function handleClubProfile(user: User): Promise<void> {
  if (!user.club_id) {
    await sendText(user.phone, '❌ You\'re not part of a club. Use /join <code> or /register <name>.');
    return;
  }

  try {
    const club = await getClubWithStats(user.club_id);
    if (!club) {
      await sendText(user.phone, '❌ Club not found.');
      return;
    }

    await sendText(user.phone, formatClubProfile(club));

    // Invite code reminder for admins
    if (user.role === 'admin') {
      await sendText(user.phone, `\n🔑 Invite code: \`${club.invite_code}\`\nShare with your team so they can /join`);
    }

  } catch (error: any) {
    console.error('❌ Club profile error:', error.message);
    await sendText(user.phone, '❌ Couldn\'t load club profile. Try again.');
  }
}

/**
 * Handle /editclub — edit club profile (admin only).
 */
export async function handleEditClub(user: User, message: WhatsAppMessage): Promise<void> {
  if (!['admin', 'god'].includes(user.role)) {
    await sendText(user.phone, '❌ Only club admins can edit the club profile.');
    return;
  }

  if (!user.club_id) {
    await sendText(user.phone, '❌ You\'re not linked to a club.');
    return;
  }

  // Check for interactive reply (field selection)
  const replyId = message.interactive?.button_reply?.id || '';

  if (replyId === 'clubedit_description') {
    await setConversationState(user.id, 'editing_club', { field: 'description' });
    await sendText(user.phone, '✏️ Send your club\'s description (1-2 sentences):');
    return;
  }
  if (replyId === 'clubedit_tagline') {
    await setConversationState(user.id, 'editing_club', { field: 'tagline' });
    await sendText(user.phone, '✏️ Send a short tagline for your club:');
    return;
  }
  if (replyId === 'clubedit_links') {
    await setConversationState(user.id, 'editing_club', { field: 'links' });
    await sendText(user.phone, '✏️ Send your links in this format:\nwebsite: https://...\ninstagram: @handle\nlinkedin: https://...\nemail: club@email.com');
    return;
  }

  // Check if this is a text reply to a field edit
  const { getConversationState } = await import('../db/supabase.js');
  const state = await getConversationState(user.id);

  if (state?.state === 'editing_club' && state.data?.field) {
    const text = message.text?.body?.trim() || '';
    if (!text) return;

    try {
      const field = state.data.field;

      if (field === 'description') {
        await updateClub(user.club_id, { description: text } as any);
        await sendText(user.phone, '✅ Description updated!');
      } else if (field === 'tagline') {
        await updateClub(user.club_id, { tagline: text.substring(0, 100) } as any);
        await sendText(user.phone, '✅ Tagline updated!');
      } else if (field === 'links') {
        const updates: any = {};
        const lines = text.split('\n');
        for (const line of lines) {
          const [key, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          const k = key.toLowerCase().trim();
          if (k === 'website') updates.website = value;
          if (k === 'instagram') updates.instagram = value.replace('@', '');
          if (k === 'linkedin') updates.linkedin = value;
          if (k === 'email') updates.email = value;
        }
        await updateClub(user.club_id, updates);
        await sendText(user.phone, '✅ Links updated!');
      }

      await clearConversationState(user.id);
      return;

    } catch (error: any) {
      console.error('Club edit error:', error.message);
      await sendText(user.phone, '❌ Update failed. Try again.');
      await clearConversationState(user.id);
      return;
    }
  }

  // Show edit options
  await sendButtons(
    user.phone,
    '✏️ *Edit Club Profile*\n\nWhat would you like to update?',
    [
      { type: 'reply', reply: { id: 'clubedit_description', title: '📝 Description' } },
      { type: 'reply', reply: { id: 'clubedit_tagline', title: '💬 Tagline' } },
      { type: 'reply', reply: { id: 'clubedit_links', title: '🔗 Links' } },
    ]
  );
}
