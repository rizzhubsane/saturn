import type { User, WhatsAppMessage } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { createClub, updateUser } from '../db/supabase.js';
import { generateInviteCode } from '../utils/inviteCode.js';

/**
 * Handle /register <club_name> — Admin registers their club.
 */
export async function handleRegisterClub(user: User, message: WhatsAppMessage): Promise<void> {
  const text = message.text?.body?.trim() || '';
  const clubName = text.replace(/^\/register\s*/i, '').trim();

  if (!clubName) {
    await sendText(user.phone, '❌ Please provide a club name.\n\nUsage: `/register <club name>`\nExample: `/register DevClub`');
    return;
  }

  // Check if user is already an admin
  if (user.role === 'admin') {
    await sendText(user.phone, '❌ You\'re already an admin of a club. Each person can admin one club.');
    return;
  }

  // Generate slug from name
  const slug = clubName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  try {
    // Generate unique invite code
    const inviteCode = await generateInviteCode();

    // Create the club
    const club = await createClub({
      name: clubName,
      slug,
      invite_code: inviteCode,
      admin_phone: user.phone,
      category: 'other',
      status: 'active',
    } as any);

    // Promote user to admin
    await updateUser(user.id, { role: 'admin', club_id: club.id } as any);

    await sendText(user.phone,
      `✅ *${clubName}* registered successfully!\n\n` +
      `🔑 Your invite code: \`${inviteCode}\`\n\n` +
      `Share this code with your publicity team. They DM me:\n` +
      `\`/join ${inviteCode}\`\n\n` +
      `📝 Next steps:\n` +
      `• /editclub — Add your club description, logo & links\n` +
      `• /adduser <phone> — Directly add a team member\n` +
      `• /help — See all admin commands`
    );

  } catch (error: any) {
    if (error.message.includes('unique') || error.message.includes('duplicate')) {
      await sendText(user.phone, `❌ A club named "${clubName}" already exists. Use a different name or contact the existing admin.`);
    } else {
      console.error('Registration error:', error);
      await sendText(user.phone, '❌ Something went wrong during registration. Please try again.');
    }
  }
}
