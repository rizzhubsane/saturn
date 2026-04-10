import type { User, ConversationState } from '../types/index.js';
import { sendText, sendButtons, sendList } from '../services/whatsapp.js';
import { createEvent, clearConversationState, getClubById, getClubBySlug, setConversationState } from '../db/supabase.js';
import { processEventImage } from '../services/imageHandler.js';
import { godPostContextFromState } from './godPostWizard.js';

/** When god has no club_id, post under this slug (must exist in DB — see seed). */
const GOD_FALLBACK_CLUB_SLUG = 'campus-announcements';

async function resolvePostingClub(user: User): Promise<{ id: string; slug: string } | null> {
  if (user.club_id) {
    const c = await getClubById(user.club_id);
    return c ? { id: c.id, slug: c.slug } : null;
  }
  if (user.role === 'god') {
    const c = await getClubBySlug(GOD_FALLBACK_CLUB_SLUG);
    return c ? { id: c.id, slug: c.slug } : null;
  }
  return null;
}

/**
 * Handle confirmation/edit/cancel of parsed event.
 */
export async function handleConfirmEvent(
  user: User,
  action: 'confirm' | 'edit' | 'cancel',
  state: ConversationState | null
): Promise<void> {
  if (!state || !state.data?.parsed) {
    await sendText(user.phone, 'No pending event to confirm. Send /post to start over.');
    return;
  }

  const { parsed, rawMessage, mediaId, hasImage } = state.data;
  const godCtx = godPostContextFromState(state);

  switch (action) {
    case 'confirm': {
      try {
        const postingClub = await resolvePostingClub(user);
        if (!postingClub) {
          await sendText(
            user.phone,
            'Cannot post: your account is not linked to a club. ' +
              `God accounts without /join fall back to *${GOD_FALLBACK_CLUB_SLUG}* — run DB seed or contact ops.`
          );
          await clearConversationState(user.id);
          break;
        }

        await sendText(user.phone, 'Posting...');

        let posterUrl: string | null = null;
        if (hasImage && mediaId) {
          try {
            const tempId = Date.now().toString(36);
            const result = await processEventImage(mediaId, postingClub.slug, tempId);
            posterUrl = result.publicUrl;
          } catch (err: any) {
            console.warn('Image upload failed:', err.message);
          }
        }

        const contentKind = godCtx?.godContentKind ?? 'event';
        const audienceScope = godCtx?.godAudienceScope ?? null;
        const skipMassBroadcast = audienceScope === 'admin';

        const event = await createEvent({
          club_id: postingClub.id,
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
          highlights: parsed.highlights || [],
          links: parsed.links || [],
          event_type: parsed.event_type || 'other',
          registration_link: parsed.registration_link || null,
          poster_url: posterUrl,
          poster_ocr_text: state.data.ocrText || null,
          status: 'confirmed',
          is_express: false,
          broadcast_sent: skipMassBroadcast,
          content_kind: contentKind,
          audience_scope: audienceScope,
        } as any);

        await clearConversationState(user.id);

        const kindLine =
          contentKind === 'event'
            ? 'Event'
            : contentKind === 'club_info'
              ? 'Club info'
              : 'Opportunity';
        const scopeNote = audienceScope
          ? audienceScope === 'admin'
            ? '_Admin audience — not included in the mass student broadcast._\n\n'
            : audienceScope === 'clubs'
              ? '_Tagged for clubs audience._\n\n'
              : '_Tagged for general audience._\n\n'
          : '';
        await sendText(
          user.phone,
          `*${kindLine} posted!*\n\n` +
            scopeNote +
            `*${parsed.title}*\n` +
            `${parsed.date}${parsed.time ? ` · ${parsed.time}` : ''}\n\n` +
            `ID: \`${event.id.substring(0, 8)}\`\n\n` +
            (contentKind === 'event'
              ? `Check /myevents for how your post is performing.`
              : `Logged with kind *${kindLine}*.`)
        );

        await sendButtons(user.phone, 'What next?', [
          { type: 'reply', reply: { id: 'action_post_another', title: 'Post Another' } },
          { type: 'reply', reply: { id: `view_${event.id}`, title: 'View Event' } },
        ]);

      } catch (error: any) {
        console.error('Event creation failed:', error.message);
        await sendText(user.phone, 'Failed to post the event. Please try again with /post.');
        await clearConversationState(user.id);
      }
      break;
    }

    case 'edit': {
      const editPayload: Record<string, unknown> = {
        parsed,
        rawMessage,
        mediaId,
        hasImage,
        ocrText: state.data.ocrText,
      };
      if (godCtx) {
        editPayload.godContentKind = godCtx.godContentKind;
        editPayload.godAudienceScope = godCtx.godAudienceScope;
      }
      await setConversationState(user.id, 'awaiting_edit', editPayload);

      await sendList(
        user.phone,
        `Which part needs fixing? Pick a field or just type your correction (e.g. "change time to 8 PM").`,
        'Pick Field',
        [
          {
            title: 'Event Details',
            rows: [
              { id: 'editfield_title', title: 'Title', description: truncate(parsed.title, 72) },
              { id: 'editfield_datetime', title: 'Date / Time', description: `${parsed.date}${parsed.time ? ' ' + parsed.time : ''}` },
              { id: 'editfield_venue', title: 'Venue', description: truncate(parsed.venue || 'Not set', 72) },
              { id: 'editfield_description', title: 'Description', description: truncate(parsed.description || 'Not set', 72) },
            ]
          },
          {
            title: 'Tags & Extras',
            rows: [
              { id: 'editfield_categories', title: 'Categories', description: (parsed.categories || []).join(', ').substring(0, 72) || 'None' },
              { id: 'editfield_highlights', title: 'Highlights', description: (parsed.highlights || []).join(', ').substring(0, 72) || 'None' },
              { id: 'editfield_links', title: 'Links', description: (parsed.links || []).map((l: any) => l.label).join(', ').substring(0, 72) || 'None' },
            ]
          },
          {
            title: 'Actions',
            rows: [
              { id: 'editfield_rewrite', title: 'Re-send Entire Message', description: 'Start over with new content' },
            ]
          }
        ]
      );
      break;
    }

    case 'cancel': {
      await clearConversationState(user.id);
      await sendText(user.phone, 'Event cancelled. Send /post whenever you\'re ready to try again.');
      break;
    }
  }
}

/**
 * Handle field-specific edit selection from the list.
 */
export async function handleEditFieldSelection(
  user: User,
  fieldId: string,
  state: ConversationState
): Promise<void> {
  const field = fieldId.replace('editfield_', '');
  const parsed = state.data.parsed;

  if (field === 'rewrite') {
    const ctx = godPostContextFromState(state);
    await setConversationState(
      user.id,
      'awaiting_event_content',
      ctx ? { godContentKind: ctx.godContentKind, godAudienceScope: ctx.godAudienceScope } : {}
    );
    await sendText(
      user.phone,
      ctx
        ? 'Send the updated message (text + optional poster). Same kind and audience as before.'
        : 'Send me the updated event message (text + optional poster).'
    );
    return;
  }

  const prompts: Record<string, string> = {
    title: `Current title: *${parsed.title}*\n\nSend the corrected title:`,
    datetime: `Current: ${parsed.date}${parsed.time ? ' at ' + parsed.time : ''}\n\nSend the corrected date and/or time (e.g. "April 15, 8 PM"):`,
    venue: `Current venue: ${parsed.venue || 'Not set'}\n\nSend the corrected venue:`,
    description: `Current description:\n${parsed.description || 'None'}\n\nSend the corrected description:`,
    categories: `Current categories: ${(parsed.categories || []).join(', ')}\n\nSend the corrected categories (comma-separated, e.g. "tech, workshop"):`,
    highlights: `Current highlights: ${(parsed.highlights || []).join(', ') || 'None'}\n\nSend the corrected highlights (what makes this event worth attending):`,
    links: `Current links:\n${(parsed.links || []).map((l: any) => `${l.label}: ${l.url}`).join('\n') || 'None'}\n\nSend the corrected links:`,
  };

  await setConversationState(user.id, 'awaiting_edit', {
    ...state.data,
    editingField: field,
  });

  await sendText(user.phone, prompts[field] || 'Send your correction:');
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max - 1) + '...' : str;
}
