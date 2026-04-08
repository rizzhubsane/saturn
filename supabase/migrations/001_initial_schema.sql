-- EventX: IITD Events WhatsApp Agent — Full Schema
-- Run against Supabase SQL Editor

-- ============================================
-- CLUBS (with rich profile fields)
-- ============================================
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  invite_code TEXT NOT NULL UNIQUE,
  admin_phone TEXT NOT NULL,
  
  -- Rich profile fields
  description TEXT,
  tagline TEXT,
  logo_url TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  website TEXT,
  instagram TEXT,
  linkedin TEXT,
  email TEXT,
  founded_year INTEGER,
  
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  interests TEXT[] DEFAULT '{}',
  onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  posted_by UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  raw_message TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  end_time TIME,
  venue TEXT,
  venue_normalized TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  registration_link TEXT,
  poster_url TEXT,
  poster_ocr_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  is_express BOOLEAN DEFAULT FALSE,
  broadcast_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REMINDERS
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  remind_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- ============================================
-- SAVED EVENTS (bookmarks)
-- ============================================
CREATE TABLE IF NOT EXISTS saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- ============================================
-- SUBSCRIPTIONS (category digests)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- ============================================
-- EVENT VIEWS (analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS event_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'dm',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSATION STATES (multi-step flows)
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_states (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_categories ON events USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_events_club ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_posted_by ON events(posted_by);
CREATE INDEX IF NOT EXISTS idx_reminders_pending ON reminders(remind_at) WHERE sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_clubs_slug ON clubs(slug);
CREATE INDEX IF NOT EXISTS idx_clubs_invite_code ON clubs(invite_code);
CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category);
CREATE INDEX IF NOT EXISTS idx_saved_events_user ON saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category ON subscriptions(category);
CREATE INDEX IF NOT EXISTS idx_event_views_event ON event_views(event_id);

-- ============================================
-- STORAGE BUCKET (for poster images)
-- ============================================
-- Run this separately in Supabase dashboard or via:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('posters', 'posters', true);
