// ============================================
// DATABASE MODELS
// ============================================

export interface Club {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  admin_phone: string;
  description: string | null;
  tagline: string | null;
  logo_url: string | null;
  category: string;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  email: string | null;
  founded_year: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: 'god' | 'admin' | 'power_user' | 'user';
  club_id: string | null;
  interests: string[];
  onboarded: boolean;
  created_at: string;
  last_active: string;
}

export interface Event {
  id: string;
  club_id: string;
  posted_by: string;
  title: string;
  description: string | null;
  raw_message: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM:SS
  end_time: string | null;
  venue: string | null;
  venue_normalized: string | null;
  categories: string[];
  registration_link: string | null;
  poster_url: string | null;
  poster_ocr_text: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired';
  is_express: boolean;
  broadcast_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields (optional)
  club?: Club;
}

export interface Reminder {
  id: string;
  user_id: string;
  event_id: string;
  remind_at: string;
  sent: boolean;
  created_at: string;
  event?: Event;
}

export interface SavedEvent {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
  event?: Event;
}

export interface Subscription {
  id: string;
  user_id: string;
  category: string;
  created_at: string;
}

export interface EventView {
  id: string;
  event_id: string;
  user_id: string | null;
  source: 'dm' | 'community';
  created_at: string;
}

export interface ConversationState {
  user_id: string;
  state: string;
  data: Record<string, any>;
  expires_at: string;
  updated_at: string;
}

// ============================================
// WHATSAPP TYPES
// ============================================

export interface WhatsAppMessage {
  from: string; // sender phone (E.164)
  id: string; // message ID
  timestamp: string;
  type: 'text' | 'image' | 'interactive' | 'button' | 'document' | 'video' | 'audio' | 'sticker' | 'location' | 'contacts' | 'order' | 'unknown';
  text?: {
    body: string;
  };
  image?: {
    id: string; // media ID for download
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
  // Profile info from contacts array
  profileName?: string;
}

export interface WhatsAppButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title: string;
  rows: WhatsAppListRow[];
}

// ============================================
// LLM / PARSING TYPES
// ============================================

export interface ParsedEvent {
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM (24hr)
  end_time: string | null;
  venue: string | null;
  venue_raw: string | null;
  categories: string[];
  registration_link: string | null;
  is_all_day: boolean;
  confidence: number;
}

export interface ParsedQuery {
  type: 'search' | 'today' | 'tomorrow' | 'this_week' | 'this_weekend';
  categories: string[];
  keywords: string[];
  time_range_start: string | null;
  time_range_end: string | null;
  intent: string;
}

// ============================================
// QUERY TYPES
// ============================================

export interface EventFilters {
  dateStart?: string;
  dateEnd?: string;
  categories?: string[];
  keywords?: string[];
  clubId?: string;
  clubSlug?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ClubWithStats extends Club {
  total_events: number;
  upcoming_events: number;
  total_views: number;
  power_user_count: number;
}

// ============================================
// CATEGORY CONFIG TYPE
// ============================================

export interface CategoryConfig {
  slug: string;
  label: string;
}
