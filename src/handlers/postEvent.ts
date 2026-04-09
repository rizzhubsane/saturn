import type { User, WhatsAppMessage, ConversationState } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { setConversationState, getClubPostCountToday } from '../db/supabase.js';
import { parseEventMessage, applyEventEdit, parseGodAnnouncement } from '../services/eventParser.js';
import { processEventImage, getImageBase64 } from '../services/imageHandler.js';
import { extractTextFromImage } from '../services/ocr.js';
import { findDuplicates } from '../utils/dedup.js';
import { formatParsedPreview } from '../utils/formatter.js';
import { getTodayIST } from '../utils/dateParser.js';
import {
  startGodPostWizard,
  godPostContextFromState,
  type GodContentKind,
  type GodAudienceScope,
} from './godPostWizard.js';

/**
 * Handle /post command -- initiate event posting flow.
 */
export async function handlePostEvent(user: User, message: WhatsAppMessage): Promise<void> {
  if (!['power_user', 'admin', 'god'].includes(user.role)) {
    await sendText(
      user.phone,
      'Only club team members can post events.\n\n' +
        'Ask your club admin for an invite code, then send:\n' +
        '`/join <invite_code>`'
    );
    return;
  }

  if (!user.club_id && user.role !== 'god') {
    await sendText(user.phone, "You're not linked to a club. Send `/join <invite_code>` first.");
    return;
  }

  const text = message.text?.body?.trim() || '';
  const contentAfterPost = text.replace(/^\/post\s*/i, '').trim();

  if (user.role === 'god' && (contentAfterPost || message.image)) {
    await sendText(
      user.phone,
      'God posts use a short wizard. Send `/post` *by itself* — I\'ll ask what you\'re publishing, who it\'s for, then you can send the text or poster.'
    );
    return;
  }

  if (user.club_id && user.role !== 'god') {
    const todayCount = await getClubPostCountToday(user.club_id);
    if (todayCount >= 5) {
      await sendText(
        user.phone,
        'Your club has reached the daily limit of 5 event posts. Try again tomorrow!'
      );
      return;
    }
  }

  if (user.role === 'god') {
    return await startGodPostWizard(user);
  }

  if (contentAfterPost || message.image) {
    return await handlePostContent(user, message, null);
  }

  await setConversationState(user.id, 'awaiting_event_content', {});
  await sendText(
    user.phone,
    'Send me the event details!\n\n' +
      'Just forward or type your publicity message -- text + poster image.\n' +
      "I'll parse it and show you a preview before posting."
  );
}

function previewMeta(
  user: User,
  state: ConversationState | null
): { contentKind: GodContentKind; audienceScope: GodAudienceScope } | undefined {
  if (user.role !== 'god') return undefined;
  const ctx = godPostContextFromState(state);
  if (!ctx) return undefined;
  return { contentKind: ctx.godContentKind, audienceScope: ctx.godAudienceScope };
}

/**
 * Handle the actual event content (text + optional image).
 * Also handles the awaiting_edit state for smart edits.
 */
export async function handlePostContent(
  user: User,
  message: WhatsAppMessage,
  state: ConversationState | null
): Promise<void> {
  const rawText = message.text?.body?.trim() || message.image?.caption?.trim() || '';

  // If we're in awaiting_edit state, route to smart edit handler
  if (state?.state === 'awaiting_edit') {
    return await handleEditContent(user, message, state);
  }

  if (!rawText && !message.image) {
    await sendText(user.phone, 'Please send a text message with event details (and optionally a poster image).');
    return;
  }

  const godCtx = godPostContextFromState(state);
  const isGodAnnouncement =
    user.role === 'god' && godCtx && (godCtx.godContentKind === 'club_info' || godCtx.godContentKind === 'opportunity');

  await sendText(user.phone, isGodAnnouncement ? 'Reading your message...' : 'Parsing your event... give me a moment.');

  try {
    let ocrText = '';
    let imageMimeType = 'image/jpeg';

    if (message.image) {
      try {
        const imageData = await getImageBase64(message.image.id);
        imageMimeType = imageData.mimeType;
        ocrText = await extractTextFromImage(imageData.base64, imageMimeType);
        console.log(`OCR extracted ${ocrText.length} chars from poster`);
      } catch (err: any) {
        console.warn('Image processing failed:', err.message);
        await sendText(user.phone, "Couldn't process the image, but I'll parse from the text.");
      }
    }

    let parsed;
    if (isGodAnnouncement) {
      parsed = await parseGodAnnouncement(rawText, ocrText, godCtx!.godContentKind as 'club_info' | 'opportunity');
    } else {
      parsed = await parseEventMessage(rawText, ocrText);
    }

    if (!isGodAnnouncement && parsed.date < getTodayIST()) {
      await sendText(
        user.phone,
        `The parsed date (${parsed.date}) is in the past. Did you mean a different date?\n\n` +
          'Please re-send your event message with the correct date.'
      );
      const back = godCtx
        ? { godContentKind: godCtx.godContentKind, godAudienceScope: godCtx.godAudienceScope }
        : {};
      await setConversationState(user.id, 'awaiting_event_content', back);
      return;
    }

    if (user.club_id && !isGodAnnouncement) {
      const duplicates = await findDuplicates(parsed, user.club_id);
      if (duplicates.length > 0) {
        await sendText(
          user.phone,
          `This looks similar to an event you already posted:\n` +
            `*${duplicates[0].title}* on ${duplicates[0].date}\n\n` +
            `I'll still let you post it -- just confirming it's not a duplicate.`
        );
      }
    }

    const confirmPayload: Record<string, unknown> = {
      parsed,
      rawMessage: rawText,
      ocrText,
      hasImage: !!message.image,
      mediaId: message.image?.id || null,
    };
    if (godCtx) {
      confirmPayload.godContentKind = godCtx.godContentKind;
      confirmPayload.godAudienceScope = godCtx.godAudienceScope;
    }

    await setConversationState(user.id, 'awaiting_confirmation', confirmPayload);

    const preview = formatParsedPreview(parsed, previewMeta(user, state));
    await sendButtons(user.phone, preview, [
      { type: 'reply', reply: { id: 'confirm_evt_new', title: 'Confirm' } },
      { type: 'reply', reply: { id: 'edit_evt_new', title: 'Edit' } },
      { type: 'reply', reply: { id: 'cancel_evt_new', title: 'Cancel' } },
    ]);
  } catch (error: any) {
    console.error('Event parsing failed:', error.message);
    await sendText(
      user.phone,
      `I couldn't parse this message. ${error.message}\n\n` +
        'Try simplifying it or make sure it includes enough detail.\n' +
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
  const godPreserve = {
    godContentKind: state.data.godContentKind as GodContentKind | undefined,
    godAudienceScope: state.data.godAudienceScope as GodAudienceScope | undefined,
  };

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

    const nextPayload: Record<string, unknown> = {
      parsed: updated,
      rawMessage: state.data.rawMessage,
      ocrText: state.data.ocrText,
      hasImage: state.data.hasImage,
      mediaId: state.data.mediaId,
    };
    if (godPreserve.godContentKind && godPreserve.godAudienceScope) {
      nextPayload.godContentKind = godPreserve.godContentKind;
      nextPayload.godAudienceScope = godPreserve.godAudienceScope;
    }

    await setConversationState(user.id, 'awaiting_confirmation', nextPayload);

    const meta =
      godPreserve.godContentKind && godPreserve.godAudienceScope
        ? { contentKind: godPreserve.godContentKind, audienceScope: godPreserve.godAudienceScope }
        : undefined;
    const preview = formatParsedPreview(updated, meta);
    await sendButtons(user.phone, `*Updated:*\n\n${preview}`, [
      { type: 'reply', reply: { id: 'confirm_evt_new', title: 'Confirm' } },
      { type: 'reply', reply: { id: 'edit_evt_new', title: 'Edit Again' } },
      { type: 'reply', reply: { id: 'cancel_evt_new', title: 'Cancel' } },
    ]);
  } catch (error: any) {
    console.error('Edit failed:', error.message);
    await sendText(user.phone, "Couldn't apply that edit. Try again or describe the change differently.");
  }
}
