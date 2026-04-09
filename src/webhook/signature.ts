import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { WHATSAPP_APP_SECRET } from '../config/env.js';

/**
 * Verify Meta X-Hub-Signature-256: HMAC-SHA256 of raw body, hex-encoded after "sha256=".
 * Compares digests in constant time; avoids throwing when lengths differ.
 */
function isValidMetaSignature(signatureHeader: string | undefined, rawBody: string, appSecret: string): boolean {
  if (!signatureHeader || typeof signatureHeader !== 'string') return false;
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;

  const receivedHex = signatureHeader.slice(prefix.length).trim();
  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');

  if (!/^[0-9a-f]+$/i.test(receivedHex) || receivedHex.length !== expectedHex.length) {
    return false;
  }

  try {
    const a = Buffer.from(receivedHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Middleware: Validate X-Hub-Signature-256 header.
 * Meta signs every webhook payload with your app secret.
 */
export function validateSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = (req as { rawBody?: string }).rawBody;

  if (!rawBody) {
    console.warn('⚠️ Raw body not available for signature verification');
    res.status(403).json({ error: 'Cannot verify signature' });
    return;
  }

  if (isValidMetaSignature(signature, rawBody, WHATSAPP_APP_SECRET)) {
    next();
    return;
  }

  console.warn('❌ Invalid webhook signature');
  res.status(403).json({ error: 'Invalid signature' });
}
