import { AsyncLocalStorage } from 'node:async_hooks';
import { ALLOW_PROACTIVE_OUTBOUND } from '../config/env.js';

const als = new AsyncLocalStorage<{ initiator: string }>();

/**
 * WhatsApp Cloud API `from` id for the user who sent the inbound message (digits, may omit leading +).
 */
export function runWithOutboundInitiator<T>(initiatorPhone: string, fn: () => Promise<T>): Promise<T> {
  return als.run({ initiator: initiatorPhone }, fn);
}

function normalizePhone(p: string): string {
  return p.replace(/\D/g, '');
}

/**
 * Whether this outbound peer is allowed in the current request.
 * When proactive mode is off, only the inbound user may receive messages for this webhook turn.
 */
export function isOutboundAllowed(to: string): boolean {
  if (ALLOW_PROACTIVE_OUTBOUND) {
    return true;
  }
  const store = als.getStore();
  if (!store) {
    return false;
  }
  return normalizePhone(to) === normalizePhone(store.initiator);
}
