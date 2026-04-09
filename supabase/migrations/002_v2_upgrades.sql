-- Saturn V2 Upgrades Migration
-- Run against Supabase SQL Editor after 001_initial_schema.sql

-- ============================================
-- EVENTS: Add highlights, links, event_type
-- ============================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS highlights TEXT[] DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'general';

-- ============================================
-- MESSAGE HISTORY (conversation memory)
-- ============================================
CREATE TABLE IF NOT EXISTS message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL DEFAULT 'in',   -- 'in' = user->bot, 'out' = bot->user
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',       -- text, image, interactive, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_history_user ON message_history(user_id, created_at DESC);
