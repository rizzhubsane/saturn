import { Request, Response } from 'express';
import { WhatsAppMessage } from '../types/index.js';
import { getOrCreateUser, logMessage, claimWebhookMessageId } from '../db/supabase.js';
import { routeMessage } from '../router/messageRouter.js';
import { markAsRead } from '../services/whatsapp.js';
import { runWithOutboundInitiator } from '../services/outboundContext.js';

/**
 * POST /webhook — Main handler for all incoming WhatsApp messages.
 * Parses the Meta Cloud API payload, extracts the message,
 * upserts the user, and routes to the appropriate handler.
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Always respond 200 immediately — Meta retries on non-2xx
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // Validate payload structure
    if (!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      // This could be a status update (delivered, read), not a message
      return;
    }

    const value = body.entry[0].changes[0].value;
    const rawMessage = value.messages[0];
    const contact = value.contacts?.[0];

    // Idempotent handling — Meta may retry the same delivery
    const claimed = await claimWebhookMessageId(rawMessage.id);
    if (!claimed) {
      console.log(`⏭️ Duplicate webhook message ${rawMessage.id}, skipping`);
      return;
    }

    // Build our typed message object
    const message: WhatsAppMessage = {
      from: rawMessage.from,
      id: rawMessage.id,
      timestamp: rawMessage.timestamp,
      type: rawMessage.type || 'unknown',
      profileName: contact?.profile?.name,
    };

    // Attach type-specific data
    if (rawMessage.type === 'text') {
      message.text = { body: rawMessage.text.body };
    } else if (rawMessage.type === 'image') {
      message.image = {
        id: rawMessage.image.id,
        mime_type: rawMessage.image.mime_type,
        sha256: rawMessage.image.sha256,
        caption: rawMessage.image.caption,
      };
      // Also set text body from caption for routing
      if (rawMessage.image.caption) {
        message.text = { body: rawMessage.image.caption };
      }
    } else if (rawMessage.type === 'interactive') {
      message.interactive = rawMessage.interactive;
    } else if (rawMessage.type === 'button') {
      // Quick reply button taps come as 'button' type
      message.interactive = {
        type: 'button_reply',
        button_reply: {
          id: rawMessage.button.payload,
          title: rawMessage.button.text,
        },
      };
      message.type = 'interactive';
    }

    console.log(`📨 Message from ${message.from} (${message.profileName || 'unknown'}): type=${message.type}, text="${message.text?.body?.substring(0, 50) || ''}"`);

    // Mark message as read (blue tick)
    await markAsRead(message.id).catch(err => {
      console.warn('Failed to mark as read:', err.message);
    });

    // Upsert user in DB
    const user = await getOrCreateUser(message.from, message.profileName || null);

    // Log incoming message for conversation memory
    const msgContent = message.text?.body || message.image?.caption || `[${message.type}]`;
    await logMessage(user.id, 'in', msgContent, message.type).catch(() => {});

    // Route to the correct handler (only this user may receive outbound replies for this turn)
    await runWithOutboundInitiator(message.from, () => routeMessage(user, message));

  } catch (error: any) {
    console.error('❌ Error handling webhook:', error.message, error.stack);
  }
}
