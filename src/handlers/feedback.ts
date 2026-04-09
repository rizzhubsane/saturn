import type { User, WhatsAppMessage, MessageHistory } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import {
  clearConversationState,
  getRecentMessages,
  setConversationState,
  submitUserFeedback,
} from '../db/supabase.js';

const CONTEXT_LIMIT = 5;
const FETCH_WINDOW = 12;

function formatContextLines(msgs: MessageHistory[]): string {
  return msgs
    .map(m => {
      const who = m.direction === 'in' ? 'User' : 'Saturn';
      return `[${who}] ${m.content}`;
    })
    .join('\n');
}

/**
 * Drop the feedback submission and any trailing /feedback prompt from chronological history,
 * then keep the last CONTEXT_LIMIT messages as context.
 */
function messagesBeforeFeedback(
  chronological: MessageHistory[],
  submittedBody: string
): MessageHistory[] {
  const out = [...chronological];
  const normalized = submittedBody.trim();

  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last.direction !== 'in') break;
    const t = last.content.trim();
    if (normalized && t === normalized) {
      out.pop();
      continue;
    }
    const lower = t.toLowerCase();
    if (lower === '/feedback' || lower.startsWith('/feedback ')) {
      out.pop();
      continue;
    }
    break;
  }

  return out.slice(-CONTEXT_LIMIT);
}

/**
 * /feedback — start flow, or submit if text follows the command.
 */
export async function handleFeedbackCommand(user: User, message: WhatsAppMessage): Promise<void> {
  const raw = message.text?.body?.trim() || '';
  const rest = raw.replace(/^\/feedback\s*/i, '').trim();

  if (!rest) {
    await setConversationState(user.id, 'awaiting_feedback_text', {}, 30);
    await sendText(
      user.phone,
      '*Feedback*\n\n' +
        'Tell us how Saturn is working for you—bugs, ideas, or praise. ' +
        'We attach your last few messages so we know what you mean.\n\n' +
        'Send your feedback now, or `/cancel` to stop.'
    );
    return;
  }

  await submitFeedbackWithContext(user, rest);
}

/**
 * Free-text reply after `/feedback` with no body.
 */
export async function handleFeedbackReply(user: User, message: WhatsAppMessage): Promise<void> {
  if (message.type !== 'text' || !message.text?.body?.trim()) {
    await sendText(user.phone, 'Please send your feedback as text, or `/cancel` to stop.');
    return;
  }

  const text = message.text.body.trim();
  if (text.toLowerCase() === '/cancel') {
    await clearConversationState(user.id);
    await sendText(user.phone, 'Okay, feedback cancelled.');
    return;
  }

  await submitFeedbackWithContext(user, text);
}

async function submitFeedbackWithContext(user: User, body: string): Promise<void> {
  await clearConversationState(user.id);

  const recent = await getRecentMessages(user.id, FETCH_WINDOW);
  const contextMsgs = messagesBeforeFeedback(recent, body);
  const contextText =
    contextMsgs.length > 0 ? formatContextLines(contextMsgs) : '(no recent chat context)';

  try {
    await submitUserFeedback(user.id, body, contextText);
    await sendText(user.phone, 'Thanks! Your feedback was saved. We read every message.');
  } catch (error: any) {
    console.error('Feedback submit error:', error.message);
    await sendText(user.phone, 'Could not save feedback right now. Please try again later.');
  }
}
