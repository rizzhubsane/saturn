import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { getClubByInviteCode, updateUser } from '../db/supabase.js';

/**
 * Handle /join <invite_code> — Power User joins a club.
 */
export async function handleJoinClub(user: User, message: WhatsAppMessage): Promise<void> {
  const text = message.text?.body?.trim() || '';
  const code = text.replace(/^\/join\s*/i, '').trim().toUpperCase();

  if (!code) {
    await sendText(user.phone, '❌ Please provide an invite code.\n\nUsage: `/join <code>`\nExample: `/join EC3K9R`\n\nAsk your club admin for the code.');
    return;
  }

  // Check if user already belongs to a club
  if (user.role === 'power_user' || user.role === 'admin') {
    await sendText(user.phone, '❌ You\'re already part of a club. You can only be a member of one club at a time.');
    return;
  }

  // Look up invite code
  const club = await getClubByInviteCode(code);
  if (!club) {
    await sendText(user.phone, '❌ Invalid invite code. Please check with your club admin.\n\nCodes are 6 characters, like: `EC3K9R`');
    return;
  }

  // Link user to club (never downgrade god role)
  if (user.role === 'god') {
    await updateUser(user.id, { club_id: club.id } as any);
  } else {
    await updateUser(user.id, { role: 'power_user', club_id: club.id } as any);
  }

  await sendText(user.phone,
    `✅ You're now a power user for *${club.name}*!\n\n` +
    `You can now post events. Just send:\n` +
    `\`/post\`\n` +
    `Then send your event publicity message (text + poster image).\n\n` +
    `I'll parse it, show you a preview, and post it after your confirmation.\n\n` +
    `Type /help to see all your commands.`
  );
}
