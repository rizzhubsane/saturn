import type { User, ConversationState } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { createEvent, clearConversationState, getClubById, setConversationState } from '../db/supabase.js';
import { processEventImage } from '../services/imageHandler.js';

/**
 * Handle confirmation/edit/cancel of parsed event.
 */
export async function handleConfirmEvent(
  user: User,
  action: 'confirm' | 'edit' | 'cancel',
  state: ConversationState | null
): Promise<void> {
  if (!state || !state.data?.parsed) {
    await sendText(user.phone, '❌ No pending event to confirm. Send /post to start over.');
    return;
  }

  const { parsed, rawMessage, mediaId, hasImage } = state.data;

  switch (action) {
    case 'confirm': {
      try {
        await sendText(user.phone, '📤 Posting your event...');

        // Upload image to Supabase Storage if present
        let posterUrl: string | null = null;
        if (hasImage && mediaId && user.club_id) {
          try {
            const club = await getClubById(user.club_id);
            const tempId = Date.now().toString(36); // temp ID before event is created
            const result = await processEventImage(mediaId, club?.slug || 'unknown', tempId);
            posterUrl = result.publicUrl;
          } catch (err: any) {
            console.warn('⚠️ Image upload failed:', err.message);
          }
        }

        // Create the event in DB
        const event = await createEvent({
          club_id: user.club_id!,
          posted_by: user.id,
          title: parsed.title,
          description: parsed.description,
          raw_message: rawMessage,
          date: parsed.date,
          time: parsed.time || null,
          end_time: parsed.end_time || null,
          venue: parsed.venue_raw || parsed.venue || null,
          venue_normalized: parsed.venue || null,
          categories: parsed.categories || [],
          registration_link: parsed.registration_link || null,
          poster_url: posterUrl,
          poster_ocr_text: state.data.ocrText || null,
          status: 'confirmed',
          is_express: false,
          broadcast_sent: false,
        } as any);

        await clearConversationState(user.id);

        await sendText(user.phone,
          `✅ *Event posted successfully!*\n\n` +
          `🎯 *${parsed.title}*\n` +
          `📅 ${parsed.date}${parsed.time ? ` · ${parsed.time}` : ''}\n\n` +
          `Your event will be included in the next community broadcast.\n` +
          `Event ID: \`${event.id.substring(0, 8)}\`\n\n` +
          `I'll send you analytics after the event date. 📊`
        );

      } catch (error: any) {
        console.error('❌ Event creation failed:', error.message);
        await sendText(user.phone, '❌ Failed to post the event. Please try again with /post.');
        await clearConversationState(user.id);
      }
      break;
    }

    case 'edit': {
      await setConversationState(user.id, 'awaiting_event_content', { 
        previousParsed: parsed,
        rawMessage 
      });
      await sendText(user.phone,
        '✏️ Send me the corrected event details.\n\n' +
        'You can send the full updated message, or describe the change:\n' +
        '• "Change time to 8 PM"\n' +
        '• "Venue is SAC not LHC"\n' +
        '• Re-send the entire message with fixes'
      );
      break;
    }

    case 'cancel': {
      await clearConversationState(user.id);
      await sendText(user.phone, '❌ Event cancelled. Send /post whenever you\'re ready to try again.');
      break;
    }
  }
}
