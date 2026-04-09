import type { User, WhatsAppMessage, ConversationState } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { setConversationState, getClubById, getClubPostCountToday } from '../db/supabase.js';
import { parseEventMessage, applyEventEdit } from '../services/eventParser.js';
import { processEventImage, getImageBase64 } from '../services/imageHandler.js';
import { extractTextFromImage } from '../services/ocr.js';
import { findDuplicates } from '../utils/dedup.js';
import { formatParsedPreview } from '../utils/formatter.js';
import { getTodayIST } from '../utils/dateParser.js';

/**
 * Handle /post command -- initiate event posting flow.
 */
export async function handlePostEvent(user: User, message: WhatsAppMessage): Promise<void> {
  if (!['power_user', 'admin', 'god'].includes(user.role)) {
    await sendText(user.phone,
      'Only club team members can post events.\n\n' +
      'Ask your club admin for an invite code, then send:\n' +
      '`/join <invite_code>`'
    );
    return;
  }

  if (!user.club_id && user.role !== 'god') {
    await sendText(user.phone, 'You\'re not linked to a club. Send `/join <invite_code>` first.');
    return;
  }

  if (user.club_id) {
    const todayCount = await getClubPostCountToday(user.club_id);
    if (todayCount >= 5) {
      await sendText(user.phone, 'Your club has reached the daily limit of 5 event posts. Try again tomorrow!');
      return;
    }
  }

  const text = message.text?.body?.trim() || '';
  const contentAfterPost = text.replace(/^\/post\s*/i, '').trim();

  if (contentAfterPost || message.image) {
    return await handlePostContent(user, message, null);
  }

  await setConversationState(user.id, 'awaiting_event_content', {});
  await sendText(user.phone,
    'Send me the event details!\n\n' +
    'Just forward or type your publicity message -- text + poster image.\n' +
    'I\'ll parse it and show you a preview before posting.'
  );
}

/**
 * Handle the actual event content (text + optional image).
 * Also handles the awaiting_edit state for smart edits.
 */
export async function handlePostContent(user: User, message: WhatsAppMessage, state: ConversationState | null): Promise<void> {
  const rawText = message.text?.body?.trim() || message.image?.caption?.trim() || '';

  // If we're in awaiting_edit state, route to smart edit handler
  if (state?.state === 'awaiting_edit') {
    return await handleEditContent(user, message, state);
  }

  if (!rawText && !message.image) {
    await sendText(user.phone, 'Please send a text message with event details (and optionally a poster image).');
    return;
  }

  await sendText(user.phone, 'Parsing your event... give me a moment.');

  try {
    let ocrText = '';
    let imageBase64 = '';
    let imageMimeType = 'image/jpeg';

    if (message.image) {
      try {
        const imageData = await getImageBase64(message.image.id);
        imageBase64 = imageData.base64;
        imageMimeType = imageData.mimeType;
        ocrText = await extractTextFromImage(imageBase64, imageMimeType);
        console.log(`OCR extracted ${ocrText.length} chars from poster`);
      } catch (err: any) {
        console.warn('Image processing failed:', err.message);
        await sendText(user.phone, 'Couldn\'t process the image, but I\'ll parse from the text.');
      }
    }

    const parsed = await parseEventMessage(rawText, ocrText);

    if (parsed.date < getTodayIST()) {
      await sendText(user.phone,
        `The parsed date (${parsed.date}) is in the past. Did you mean a different date?\n\n` +
        'Please re-send your event message with the correct date.'
      );
      await setConversationState(user.id, 'awaiting_event_content', {});
      return;
    }

    if (user.club_id) {
      const duplicates = await findDuplicates(parsed, user.club_id);
      if (duplicates.length > 0) {
        await sendText(user.phone,
          `This looks similar to an event you already posted:\n` +
          `*${duplicates[0].title}* on ${duplicates[0].date}\n\n` +
          `I'll still let you post it -- just confirming it's not a duplicate.`
        );
      }
    }

    await setConversationState(user.id, 'awaiting_confirmation', {
      parsed,
      rawMessage: rawText,
      ocrText,
      hasImage: !!message.image,
      mediaId: message.image?.id || null,
    });

    const preview = formatParsedPreview(parsed);
    await sendButtons(
      user.phone,
      preview,
      [
        { type: 'reply', reply: { id: 'confirm_evt_new', title: 'Confirm' } },
        { type: 'reply', reply: { id: 'edit_evt_new', title: 'Edit' } },
        { type: 'reply', reply: { id: 'cancel_evt_new', title: 'Cancel' } },
      ]
    );

  } catch (error: any) {
    console.error('Event parsing failed:', error.message);
    await sendText(user.phone,
      `I couldn't parse this message. ${error.message}\n\n` +
      'Try simplifying it or make sure it includes at least an event name and date.\n' +
      'Send /post to try again.'
    );
    const { clearConversationState } = await import('../db/supabase.js');
    await clearConversationState(user.id);
  }
}

/**
 * Handle edit content -- applies a smart edit to the previously parsed event.
 */
async function handleEditContent(user: User, message: WhatsAppMessage, state: ConversationState): Promise<void> {
  const editText = message.text?.body?.trim() || '';
  const parsed = state.data.parsed;
  const editingField = state.data.editingField;

  if (!editText) {
    await sendText(user.phone, 'Send your correction as a text message.');
    return;
  }

  await sendText(user.phone, 'Applying your edit...');

  try {
    let updated;

    if (editingField) {
      // Direct field edit -- apply without LLM for simple fields
      updated = { ...parsed };
      switch (editingField) {
        case 'title':
          updated.title = editText;
          break;
        case 'venue':
          updated.venue = editText;
          updated.venue_raw = editText;
          break;
        case 'description':
          updated.description = editText;
          break;
        default:
          // For complex fields (datetime, categories, highlights, links), use LLM
          updated = await applyEventEdit(parsed, `Change ${editingField} to: ${editText}`);
      }
    } else {
      // Free-form edit instruction -- use LLM
      updated = await applyEventEdit(parsed, editText);
    }

    // Store updated parse and show preview
    await setConversationState(user.id, 'awaiting_confirmation', {
      parsed: updated,
      rawMessage: state.data.rawMessage,
      ocrText: state.data.ocrText,
      hasImage: state.data.hasImage,
      mediaId: state.data.mediaId,
    });

    const preview = formatParsedPreview(updated);
    await sendButtons(
      user.phone,
      `*Updated:*\n\n${preview}`,
      [
        { type: 'reply', reply: { id: 'confirm_evt_new', title: 'Confirm' } },
        { type: 'reply', reply: { id: 'edit_evt_new', title: 'Edit Again' } },
        { type: 'reply', reply: { id: 'cancel_evt_new', title: 'Cancel' } },
      ]
    );

  } catch (error: any) {
    console.error('Edit failed:', error.message);
    await sendText(user.phone, `Couldn't apply that edit. Try again or describe the change differently.`);
  }
}
