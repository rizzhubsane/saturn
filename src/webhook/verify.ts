import { Request, Response } from 'express';
import { WHATSAPP_VERIFY_TOKEN } from '../config/env.js';

/**
 * GET /webhook — Meta webhook verification (challenge-response).
 * Meta sends this when you first register the webhook URL.
 */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.warn('❌ Webhook verification failed — token mismatch');
    res.status(403).send('Forbidden');
  }
}
