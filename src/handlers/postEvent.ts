import type { User, WhatsAppMessage, ConversationState } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { setConversationState, getClubById, getClubPostCountToday } from '../db/supabase.js';
import { parseEventMessage } from '../services/eventParser.js';
import { processEventImage, getImageBase64 } from '../services/imageHandler.js';
import { extractTextFromImage } from '../services/ocr.js';
import { findDuplicates } from '../utils/dedup.js';
import { formatParsedPreview } from '../utils/formatter.js';
import { getTodayIST } from '../utils/dateParser.js';

/**
 * Handle /post command — initiate event posting flow.
 */
export async function handlePostEvent(user: User, message: WhatsAppMessage): Promise<void> {
  // Check permissions
  if (!['power_user', 'admin', 'god'].includes(user.role)) {
    await sendText(user.phone, 
      '❌ Only club team members can post events.\n\n' +
      'Ask your club admin for an invite code, then send:\n' +
      '`/join <invite_code>`'
    );
    return;
  }

  if (!user.club_id && user.role !== 'god') {
    await sendText(user.phone, '❌ You\'re not linked to a club. Send `/join <invite_code>` first.');
    return;
  }

  // Rate limit check
  if (user.club_id) {
    const todayCount = await getClubPostCountToday(user.club_id);
    if (todayCount >= 5) {
      await sendText(user.phone, '⚠️ Your club has reached the daily limit of 5 event posts. Try again tomorrow!');
      return;
    }
  }

  const text = message.text?.body?.trim() || '';
  const contentAfterPost = text.replace(/^\/post\s*/i, '').trim();

  // Check if content came with the /post command
  if (contentAfterPost || message.image) {
    // Content provided with /post — go straight to parsing
    return await handlePostContent(user, message, null);
  }

  // No content yet — ask for it
  await setConversationState(user.id, 'awaiting_event_content', {});
  await sendText(user.phone, 
    '📝 Send me the event details!\n\n' +
    'Just forward or type your publicity message — text + poster image.\n' +
    'I\'ll parse it and show you a preview before posting.'
  );
}

/**
 * Handle the actual event content (text + optional image).
 */
export async function handlePostContent(user: User, message: WhatsAppMessage, state: ConversationState | null): Promise<void> {
  const rawText = message.text?.body?.trim() || message.image?.caption?.trim() || '';

  if (!rawText && !message.image) {
    await sendText(user.phone, '❌ Please send a text message with event details (and optionally a poster image).');
    return;
  }

  await sendText(user.phone, '🔄 Parsing your event... give me a moment.');

  try {
    let ocrText = '';
    let imageBase64 = '';
    let imageMimeType = 'image/jpeg';

    // Process image if present
    if (message.image) {
      try {
        const imageData = await getImageBase64(message.image.id);
        imageBase64 = imageData.base64;
        imageMimeType = imageData.mimeType;

        // Run OCR on the poster
        ocrText = await extractTextFromImage(imageBase64, imageMimeType);
        console.log(`📸 OCR extracted ${ocrText.length} chars from poster`);
      } catch (err: any) {
        console.warn('⚠️ Image processing failed:', err.message);
        await sendText(user.phone, '⚠️ Couldn\'t process the image, but I\'ll parse from the text.');
      }
    }

    // Parse the event message
    const parsed = await parseEventMessage(rawText, ocrText);

    // Check for past dates
    if (parsed.date < getTodayIST()) {
      await sendText(user.phone, 
        `❌ The parsed date (${parsed.date}) is in the past. Did you mean a different date?\n\n` +
        'Please re-send your event message with the correct date.'
      );
      await setConversationState(user.id, 'awaiting_event_content', {});
      return;
    }

    // Check for duplicates
    if (user.club_id) {
      const duplicates = await findDuplicates(parsed, user.club_id);
      if (duplicates.length > 0) {
        await sendText(user.phone, 
          `⚠️ This looks similar to an event you already posted:\n` +
          `*${duplicates[0].title}* on ${duplicates[0].date}\n\n` +
          `I'll still let you post it — just confirming it's not a duplicate.`
        );
      }
    }

    // Store parsed data in conversation state
    await setConversationState(user.id, 'awaiting_confirmation', {
      parsed,
      rawMessage: rawText,
      ocrText,
      hasImage: !!message.image,
      mediaId: message.image?.id || null,
    });

    // Send preview with confirmation buttons
    const preview = formatParsedPreview(parsed);
    await sendButtons(
      user.phone,
      preview,
      [
        { type: 'reply', reply: { id: 'confirm_evt_new', title: '✅ Confirm' } },
        { type: 'reply', reply: { id: 'edit_evt_new', title: '✏️ Edit' } },
        { type: 'reply', reply: { id: 'cancel_evt_new', title: '❌ Cancel' } },
      ]
    );

  } catch (error: any) {
    console.error('❌ Event parsing failed:', error.message);
    await sendText(user.phone, 
      `❌ I couldn't parse this message. ${error.message}\n\n` +
      'Try simplifying it or make sure it includes at least an event name and date.\n' +
      'Send /post to try again.'
    );
    const { clearConversationState } = await import('../db/supabase.js');
    await clearConversationState(user.id);
  }
}
