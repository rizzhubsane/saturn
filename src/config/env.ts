import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

// ── Meta WhatsApp Cloud API ──
export const WHATSAPP_PHONE_NUMBER_ID = required('WHATSAPP_PHONE_NUMBER_ID');
export const WHATSAPP_BUSINESS_ACCOUNT_ID = required('WHATSAPP_BUSINESS_ACCOUNT_ID');
export const WHATSAPP_ACCESS_TOKEN = required('WHATSAPP_ACCESS_TOKEN');
export const WHATSAPP_VERIFY_TOKEN = required('WHATSAPP_VERIFY_TOKEN');
export const WHATSAPP_APP_SECRET = required('WHATSAPP_APP_SECRET');
export const WHATSAPP_COMMUNITY_GROUP_ID = optional('WHATSAPP_COMMUNITY_GROUP_ID');

// ── OpenRouter (Gemini 2.5 Flash) ──
export const OPENROUTER_API_KEY = required('OPENROUTER_API_KEY');
export const OPENROUTER_MODEL = optional('OPENROUTER_MODEL', 'google/gemini-3-flash-preview');

// ── Supabase ──
export const SUPABASE_URL = required('SUPABASE_URL');
export const SUPABASE_ANON_KEY = optional('SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

// ── App Config ──
export const PORT = parseInt(optional('PORT', '3000'), 10);
export const NODE_ENV = optional('NODE_ENV', 'development');
export const TIMEZONE = optional('TIMEZONE', 'Asia/Kolkata');
export const GOD_PHONE = required('GOD_PHONE');

/**
 * When false (default), WhatsApp sends only go to the user who triggered the current webhook.
 * God-only: set `true` to allow `/broadcast` to all users and the welcome DM from `/promote`.
 * (Scheduled digests / reminder pings / subscriber pushes are not used — Saturn only replies in DMs.)
 */
export const ALLOW_PROACTIVE_OUTBOUND = optional('ALLOW_PROACTIVE_OUTBOUND', 'false') === 'true';

/** Public base URL (https, no trailing slash) for ICS links — e.g. https://api.yourdomain.com */
export const PUBLIC_BASE_URL = optional('PUBLIC_BASE_URL', '').replace(/\/$/, '');

// ── WhatsApp API Base URL ──
export const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}`;
