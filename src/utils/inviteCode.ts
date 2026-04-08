import { inviteCodeExists } from '../db/supabase.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion

/**
 * Generate a unique 6-character alphanumeric invite code.
 * Avoids ambiguous characters (I/l/1, O/0).
 */
export async function generateInviteCode(): Promise<string> {
  let code: string;
  let attempts = 0;

  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    attempts++;

    if (attempts > 100) {
      throw new Error('Failed to generate unique invite code after 100 attempts');
    }
  } while (await inviteCodeExists(code));

  return code;
}
