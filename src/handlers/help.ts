import type { User } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { formatHelp } from '../utils/formatter.js';

/**
 * Handle /help command — sends role-aware command list.
 */
export async function handleHelp(user: User): Promise<void> {
  const helpText = formatHelp(user.role);
  await sendText(user.phone, helpText);
}
