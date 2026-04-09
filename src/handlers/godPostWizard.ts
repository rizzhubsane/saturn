import type { User, ConversationState } from '../types/index.js';
import { sendText, sendButtons } from '../services/whatsapp.js';
import { setConversationState, getConversationState } from '../db/supabase.js';

export type GodContentKind = 'event' | 'club_info' | 'opportunity';
export type GodAudienceScope = 'clubs' | 'admin' | 'general';

export const GOD_KIND_BUTTONS = {
  event: 'god_kind_event',
  club_info: 'god_kind_clubinfo',
  opportunity: 'god_kind_opportunity',
} as const;

export const GOD_AUD_BUTTONS = {
  clubs: 'god_aud_clubs',
  admin: 'god_aud_admin',
  general: 'god_aud_general',
} as const;

export function parseGodKindReplyId(id: string | undefined): GodContentKind | null {
  if (!id) return null;
  if (id === GOD_KIND_BUTTONS.event) return 'event';
  if (id === GOD_KIND_BUTTONS.club_info) return 'club_info';
  if (id === GOD_KIND_BUTTONS.opportunity) return 'opportunity';
  return null;
}

export function parseGodAudienceReplyId(id: string | undefined): GodAudienceScope | null {
  if (!id) return null;
  if (id === GOD_AUD_BUTTONS.clubs) return 'clubs';
  if (id === GOD_AUD_BUTTONS.admin) return 'admin';
  if (id === GOD_AUD_BUTTONS.general) return 'general';
  return null;
}

function labelKind(k: GodContentKind): string {
  if (k === 'event') return 'Event';
  if (k === 'club_info') return 'Club info';
  return 'Opportunity';
}

function labelScope(s: GodAudienceScope): string {
  if (s === 'clubs') return 'Clubs';
  if (s === 'admin') return 'Admin';
  return 'General';
}

/**
 * Start god-only wizard: kind → audience → content.
 */
export async function startGodPostWizard(user: User): Promise<void> {
  await setConversationState(user.id, 'god_choose_kind', {});
  await sendButtons(
    user.phone,
    'You\'re posting as *god*. What are you publishing?\n\n' +
      '• *Event* — a dated campus event (talks, fests, competitions)\n' +
      '• *Club info* — notices, fee updates, society circulars\n' +
      '• *Opportunity* — jobs, internships, grants, application windows',
    [
      { type: 'reply', reply: { id: GOD_KIND_BUTTONS.event, title: 'Event' } },
      { type: 'reply', reply: { id: GOD_KIND_BUTTONS.club_info, title: 'Club info' } },
      { type: 'reply', reply: { id: GOD_KIND_BUTTONS.opportunity, title: 'Opportunity' } },
    ]
  );
}

export async function handleGodKindSelection(user: User, replyId: string): Promise<void> {
  const kind = parseGodKindReplyId(replyId);
  if (!kind) {
    await sendText(user.phone, 'Please tap one of the buttons above.');
    return;
  }
  await setConversationState(user.id, 'god_choose_audience', { godContentKind: kind });
  await sendButtons(
    user.phone,
    'Who is this mainly for?\n\n' +
      '• *Clubs* — club teams / society leads\n' +
      '• *Admin* — institute-facing (won\'t go in the mass student broadcast)\n' +
      '• *General* — all students',
    [
      { type: 'reply', reply: { id: GOD_AUD_BUTTONS.clubs, title: 'Clubs' } },
      { type: 'reply', reply: { id: GOD_AUD_BUTTONS.admin, title: 'Admin' } },
      { type: 'reply', reply: { id: GOD_AUD_BUTTONS.general, title: 'General' } },
    ]
  );
}

export async function handleGodAudienceSelection(user: User, replyId: string): Promise<void> {
  const scope = parseGodAudienceReplyId(replyId);
  if (!scope) {
    await sendText(user.phone, 'Please tap one of the buttons above.');
    return;
  }
  const prev = await getConversationState(user.id);
  const kind = prev?.data?.godContentKind as GodContentKind | undefined;
  if (!kind) {
    await sendText(user.phone, 'Session expired. Send `/post` again.');
    return;
  }

  await setConversationState(user.id, 'awaiting_event_content', {
    godContentKind: kind,
    godAudienceScope: scope,
  });

  const hint =
    kind === 'event'
      ? 'Send your publicity message (text + optional poster). I\'ll parse date, time, and venue.'
      : kind === 'club_info'
        ? 'Send the notice or update (text + optional image). I\'ll structure it for the feed.'
        : 'Send the opportunity details (text + optional image). I\'ll extract title, links, and deadlines.';

  await sendText(
    user.phone,
    `*${labelKind(kind)}* · *${labelScope(scope)}*\n\n${hint}`
  );
}

/** Preserve god wizard selections when re-entering content (rewrite / retry). */
export function godPostContextFromState(state: ConversationState | null): {
  godContentKind: GodContentKind;
  godAudienceScope: GodAudienceScope;
} | null {
  const k = state?.data?.godContentKind as GodContentKind | undefined;
  const a = state?.data?.godAudienceScope as GodAudienceScope | undefined;
  if (!k || !a) return null;
  return { godContentKind: k, godAudienceScope: a };
}
