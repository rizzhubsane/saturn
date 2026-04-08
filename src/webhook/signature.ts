import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { WHATSAPP_APP_SECRET } from '../config/env.js';

/**
 * Middleware: Validate X-Hub-Signature-256 header.
 * Meta signs every webhook payload with your app secret.
 * We verify the HMAC-SHA256 to ensure the request is legitimate.
 */
export function validateSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    console.warn('⚠️ Missing X-Hub-Signature-256 header');
    res.status(403).json({ error: 'Missing signature' });
    return;
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.warn('⚠️ Raw body not available for signature verification');
    res.status(403).json({ error: 'Cannot verify signature' });
    return;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    next();
  } else {
    console.warn('❌ Invalid webhook signature');
    res.status(403).json({ error: 'Invalid signature' });
  }
}
