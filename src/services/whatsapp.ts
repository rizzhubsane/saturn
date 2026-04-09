import axios from 'axios';
import { WHATSAPP_API_URL, WHATSAPP_ACCESS_TOKEN } from '../config/env.js';
import type { WhatsAppButton, WhatsAppListSection } from '../types/index.js';

const api = axios.create({
  baseURL: WHATSAPP_API_URL,
  headers: {
    'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * Send a plain text message.
 */
export async function sendText(to: string, text: string): Promise<void> {
  // WhatsApp has a 4096 character limit
  if (text.length > 4096) {
    const chunks = splitMessage(text, 4000);
    for (const chunk of chunks) {
      await api.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: chunk },
      });
    }
    // Log only the first chunk to keep history concise
    logOutgoing(to, chunks[0]);
    return;
  }

  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });

  logOutgoing(to, text);
}

function logOutgoing(phone: string, text: string): void {
  import('../db/supabase.js').then(({ supabase, logMessage }) => {
    supabase.from('users').select('id').eq('phone', phone).single()
      .then(({ data }: any) => {
        if (data?.id) logMessage(data.id, 'out', text, 'text').catch(() => {});
      });
  }).catch(() => {});
}

/**
 * Send an image message with optional caption.
 */
export async function sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: {
      link: imageUrl,
      ...(caption && { caption: caption.substring(0, 1024) }),
    },
  });
}

/**
 * Send an interactive button message (max 3 buttons).
 */
export async function sendButtons(
  to: string,
  body: string,
  buttons: WhatsAppButton[],
  header?: string,
  footer?: string
): Promise<void> {
  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body.substring(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3), // Max 3 buttons
      },
    },
  };

  if (header) {
    payload.interactive.header = { type: 'text', text: header.substring(0, 60) };
  }
  if (footer) {
    payload.interactive.footer = { text: footer.substring(0, 60) };
  }

  await api.post('/messages', payload);
}

/**
 * Send an interactive list message (max 10 items per section, max 10 sections).
 */
export async function sendList(
  to: string,
  body: string,
  buttonText: string,
  sections: WhatsAppListSection[],
  header?: string,
  footer?: string
): Promise<void> {
  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body.substring(0, 1024) },
      action: {
        button: buttonText.substring(0, 20),
        sections: sections.slice(0, 10).map(section => ({
          title: section.title.substring(0, 24),
          rows: section.rows.slice(0, 10).map(row => ({
            id: row.id.substring(0, 200),
            title: row.title.substring(0, 24),
            description: row.description?.substring(0, 72),
          })),
        })),
      },
    },
  };

  if (header) {
    payload.interactive.header = { type: 'text', text: header.substring(0, 60) };
  }
  if (footer) {
    payload.interactive.footer = { text: footer.substring(0, 60) };
  }

  await api.post('/messages', payload);
}

/**
 * Send a template message (must be pre-approved in Meta Business Manager).
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  parameters: string[] = []
): Promise<void> {
  const components: any[] = [];
  if (parameters.length > 0) {
    components.push({
      type: 'body',
      parameters: parameters.map(p => ({ type: 'text', text: p })),
    });
  }

  await api.post('/messages', {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 && { components }),
    },
  });
}

/**
 * Mark a message as read (blue ticks).
 */
export async function markAsRead(messageId: string): Promise<void> {
  await api.post('/messages', {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

/**
 * Download media from WhatsApp (get URL first, then download).
 */
export async function getMediaUrl(mediaId: string): Promise<string> {
  const response = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  return response.data.url;
}

export async function downloadMedia(mediaUrl: string): Promise<Buffer> {
  const response = await axios.get(mediaUrl, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(response.data);
}

/**
 * Split a long message into chunks at line boundaries.
 */
function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
