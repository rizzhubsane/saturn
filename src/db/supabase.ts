import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config/env.js';
import type { User, Club, Event, Reminder, ConversationState, EventFilters, ClubWithStats } from '../types/index.js';

// ── Initialize Supabase client with service role key ──
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export { supabase };

// ============================================
// USER OPERATIONS
// ============================================

export async function getOrCreateUser(phone: string, name: string | null): Promise<User> {
  // Try to find existing user
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existing) {
    // Update last_active and name if provided
    const updates: any = { last_active: new Date().toISOString() };
    if (name && !existing.name) updates.name = name;

    await supabase.from('users').update(updates).eq('id', existing.id);
    return { ...existing, ...updates } as User;
  }

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      phone,
      name,
      role: 'user',
      interests: [],
      onboarded: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return newUser as User;
}

export async function getUserByPhone(phone: string): Promise<User | null> {
  const { data } = await supabase.from('users').select('*').eq('phone', phone).single();
  return data as User | null;
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  const { error } = await supabase.from('users').update(updates).eq('id', userId);
  if (error) throw new Error(`Failed to update user: ${error.message}`);
}

// ============================================
// CLUB OPERATIONS
// ============================================

export async function createClub(data: Partial<Club>): Promise<Club> {
  const { data: club, error } = await supabase.from('clubs').insert(data).select().single();
  if (error) throw new Error(`Failed to create club: ${error.message}`);
  return club as Club;
}

export async function getClubByInviteCode(code: string): Promise<Club | null> {
  const { data } = await supabase
    .from('clubs')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .eq('status', 'active')
    .single();
  return data as Club | null;
}

export async function getClubBySlug(slug: string): Promise<Club | null> {
  const { data } = await supabase
    .from('clubs')
    .select('*')
    .eq('slug', slug.toLowerCase())
    .eq('status', 'active')
    .single();
  return data as Club | null;
}

export async function getClubById(id: string): Promise<Club | null> {
  const { data } = await supabase.from('clubs').select('*').eq('id', id).single();
  return data as Club | null;
}

export async function getClubByName(name: string): Promise<Club | null> {
  const { data } = await supabase
    .from('clubs')
    .select('*')
    .ilike('name', name)
    .eq('status', 'active')
    .single();
  return data as Club | null;
}

export async function updateClub(clubId: string, updates: Partial<Club>): Promise<void> {
  const { error } = await supabase
    .from('clubs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', clubId);
  if (error) throw new Error(`Failed to update club: ${error.message}`);
}

export async function getAllActiveClubs(): Promise<Club[]> {
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('status', 'active')
    .order('name');
  if (error) throw new Error(`Failed to fetch clubs: ${error.message}`);
  return (data || []) as Club[];
}

export async function getClubWithStats(clubId: string): Promise<ClubWithStats | null> {
  const club = await getClubById(clubId);
  if (!club) return null;

  const today = new Date().toISOString().split('T')[0];

  // Total events
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'confirmed');

  // Upcoming events
  const { count: upcomingEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'confirmed')
    .gte('date', today);

  // Total views
  const { data: eventIds } = await supabase
    .from('events')
    .select('id')
    .eq('club_id', clubId);
  
  let totalViews = 0;
  if (eventIds && eventIds.length > 0) {
    const ids = eventIds.map(e => e.id);
    const { count } = await supabase
      .from('event_views')
      .select('*', { count: 'exact', head: true })
      .in('event_id', ids);
    totalViews = count || 0;
  }

  // Power user count
  const { count: powerUserCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .in('role', ['power_user', 'admin']);

  return {
    ...club,
    total_events: totalEvents || 0,
    upcoming_events: upcomingEvents || 0,
    total_views: totalViews,
    power_user_count: powerUserCount || 0,
  };
}

// ============================================
// EVENT OPERATIONS
// ============================================

export async function createEvent(data: Partial<Event>): Promise<Event> {
  const { data: event, error } = await supabase.from('events').insert(data).select().single();
  if (error) throw new Error(`Failed to create event: ${error.message}`);
  return event as Event;
}

export async function getEventById(id: string): Promise<Event | null> {
  const { data } = await supabase
    .from('events')
    .select('*, club:clubs(*)')
    .eq('id', id)
    .single();
  return data as (Event & { club: Club }) | null;
}

export async function updateEvent(eventId: string, updates: Partial<Event>): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) throw new Error(`Failed to update event: ${error.message}`);
}

export async function queryEvents(filters: EventFilters): Promise<Event[]> {
  let query = supabase
    .from('events')
    .select('*, club:clubs(id, name, slug)')
    .eq('status', filters.status || 'confirmed')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (filters.dateStart) {
    query = query.gte('date', filters.dateStart);
  }
  if (filters.dateEnd) {
    query = query.lte('date', filters.dateEnd);
  }
  if (filters.clubId) {
    query = query.eq('club_id', filters.clubId);
  }
  if (filters.categories && filters.categories.length > 0) {
    query = query.overlaps('categories', filters.categories);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to query events: ${error.message}`);

  let results = (data || []) as Event[];

  // Keyword filtering (ILIKE not easily chainable with overlaps in Supabase-js)
  if (filters.keywords && filters.keywords.length > 0) {
    const keywordLower = filters.keywords.map(k => k.toLowerCase());
    results = results.filter(event =>
      keywordLower.some(kw =>
        event.title.toLowerCase().includes(kw) ||
        (event.description || '').toLowerCase().includes(kw)
      )
    );
  }

  return results;
}

export async function getEventsByClub(clubId: string, onlyUpcoming: boolean = true): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0];
  let query = supabase
    .from('events')
    .select('*, club:clubs(id, name, slug)')
    .eq('club_id', clubId)
    .eq('status', 'confirmed')
    .order('date', { ascending: true });

  if (onlyUpcoming) {
    query = query.gte('date', today);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch club events: ${error.message}`);
  return (data || []) as Event[];
}

export async function getEventsPostedBy(userId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, club:clubs(id, name, slug)')
    .eq('posted_by', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(`Failed to fetch user events: ${error.message}`);
  return (data || []) as Event[];
}

export async function getUnbroadcastedEvents(): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .select('*, club:clubs(id, name, slug)')
    .eq('status', 'confirmed')
    .eq('broadcast_sent', false)
    .gte('date', today)
    .order('date', { ascending: true });
  if (error) throw new Error(`Failed to fetch unbroadcasted events: ${error.message}`);
  return (data || []) as Event[];
}

export async function expirePastEvents(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('events')
    .update({ status: 'expired' })
    .lt('date', today)
    .eq('status', 'confirmed')
    .select('id');
  if (error) throw new Error(`Failed to expire events: ${error.message}`);
  return data?.length || 0;
}

// ============================================
// REMINDER OPERATIONS
// ============================================

export async function createReminder(userId: string, eventId: string, remindAt: Date): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({ user_id: userId, event_id: eventId, remind_at: remindAt.toISOString() })
    .select()
    .single();
  if (error) throw new Error(`Failed to create reminder: ${error.message}`);
  return data as Reminder;
}

export async function getPendingReminders(): Promise<Reminder[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('reminders')
    .select('*, event:events(*, club:clubs(id, name))')
    .eq('sent', false)
    .lte('remind_at', now);
  if (error) throw new Error(`Failed to fetch pending reminders: ${error.message}`);
  return (data || []) as Reminder[];
}

export async function markReminderSent(reminderId: string): Promise<void> {
  await supabase.from('reminders').update({ sent: true }).eq('id', reminderId);
}

export async function getUserReminders(userId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*, event:events(id, title, date, time, venue)')
    .eq('user_id', userId)
    .eq('sent', false)
    .order('remind_at', { ascending: true });
  if (error) throw new Error(`Failed to fetch user reminders: ${error.message}`);
  return (data || []) as Reminder[];
}

// ============================================
// SAVED EVENT OPERATIONS
// ============================================

export async function saveEvent(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_events')
    .upsert({ user_id: userId, event_id: eventId });
  if (error) throw new Error(`Failed to save event: ${error.message}`);
}

export async function unsaveEvent(userId: string, eventId: string): Promise<void> {
  await supabase
    .from('saved_events')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);
}

export async function getSavedEvents(userId: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from('saved_events')
    .select('event:events(*, club:clubs(id, name, slug))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to fetch saved events: ${error.message}`);
  return (data || []).map((d: any) => d.event).filter(Boolean) as Event[];
}

// ============================================
// SUBSCRIPTION OPERATIONS
// ============================================

export async function addSubscription(userId: string, category: string): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .upsert({ user_id: userId, category });
  if (error) throw new Error(`Failed to add subscription: ${error.message}`);
}

export async function removeSubscription(userId: string, category: string): Promise<void> {
  await supabase
    .from('subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('category', category);
}

export async function getUserSubscriptions(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('category')
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to fetch subscriptions: ${error.message}`);
  return (data || []).map(s => s.category);
}

export async function getSubscribersForCategory(category: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user:users(*)')
    .eq('category', category);
  if (error) throw new Error(`Failed to fetch subscribers: ${error.message}`);
  return (data || []).map((d: any) => d.user).filter(Boolean) as User[];
}

// ============================================
// EVENT VIEWS (ANALYTICS)
// ============================================

export async function logEventView(eventId: string, userId: string | null, source: 'dm' | 'community' = 'dm'): Promise<void> {
  await supabase.from('event_views').insert({
    event_id: eventId,
    user_id: userId,
    source,
  });
}

export async function getEventViewCount(eventId: string): Promise<number> {
  const { count } = await supabase
    .from('event_views')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  return count || 0;
}

export async function getEventSaveCount(eventId: string): Promise<number> {
  const { count } = await supabase
    .from('saved_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  return count || 0;
}

export async function getEventReminderCount(eventId: string): Promise<number> {
  const { count } = await supabase
    .from('reminders')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  return count || 0;
}

// ============================================
// CONVERSATION STATE
// ============================================

export async function setConversationState(
  userId: string,
  state: string,
  data: Record<string, any> = {},
  ttlMinutes: number = 30
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('conversation_states')
    .upsert({
      user_id: userId,
      state,
      data,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(`Failed to set conversation state: ${error.message}`);
}

export async function getConversationState(userId: string): Promise<ConversationState | null> {
  const { data } = await supabase
    .from('conversation_states')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) return null;

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    await clearConversationState(userId);
    return null;
  }

  return data as ConversationState;
}

export async function clearConversationState(userId: string): Promise<void> {
  await supabase.from('conversation_states').delete().eq('user_id', userId);
}

export async function cleanupExpiredStates(): Promise<void> {
  await supabase
    .from('conversation_states')
    .delete()
    .lt('expires_at', new Date().toISOString());
}

// ============================================
// SYSTEM STATS (GOD)
// ============================================

export async function getSystemStats(): Promise<{
  totalUsers: number;
  totalClubs: number;
  totalEvents: number;
  activeEvents: number;
  totalViews: number;
  totalReminders: number;
}> {
  const [users, clubs, events, activeEvents, views, reminders] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('clubs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    supabase.from('event_views').select('*', { count: 'exact', head: true }),
    supabase.from('reminders').select('*', { count: 'exact', head: true }),
  ]);

  return {
    totalUsers: users.count || 0,
    totalClubs: clubs.count || 0,
    totalEvents: events.count || 0,
    activeEvents: activeEvents.count || 0,
    totalViews: views.count || 0,
    totalReminders: reminders.count || 0,
  };
}

// ============================================
// POWER USER COUNT CHECK (RATE LIMITING)
// ============================================

export async function getClubPostCountToday(clubId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .gte('created_at', `${today}T00:00:00.000Z`);
  return count || 0;
}

export async function getClubMembers(clubId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('club_id', clubId)
    .in('role', ['power_user', 'admin'])
    .order('created_at');
  if (error) throw new Error(`Failed to fetch club members: ${error.message}`);
  return (data || []) as User[];
}

export async function inviteCodeExists(code: string): Promise<boolean> {
  const { data } = await supabase
    .from('clubs')
    .select('id')
    .eq('invite_code', code)
    .single();
  return !!data;
}
