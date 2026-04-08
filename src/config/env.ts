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
export const OPENROUTER_MODEL = optional('OPENROUTER_MODEL', 'google/gemini-2.5-flash');

// ── Supabase ──
export const SUPABASE_URL = required('SUPABASE_URL');
export const SUPABASE_ANON_KEY = optional('SUPABASE_ANON_KEY');
export const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

// ── App Config ──
export const PORT = parseInt(optional('PORT', '3000'), 10);
export const NODE_ENV = optional('NODE_ENV', 'development');
export const TIMEZONE = optional('TIMEZONE', 'Asia/Kolkata');
export const GOD_PHONE = required('GOD_PHONE');

// ── WhatsApp API Base URL ──
export const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}`;
