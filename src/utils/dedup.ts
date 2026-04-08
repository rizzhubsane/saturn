import { distance } from 'fastest-levenshtein';
import { supabase } from '../db/supabase.js';
import type { ParsedEvent, Event } from '../types/index.js';

/**
 * Check for duplicate events from the same club.
 * Looks for events with similar title within ±1 day.
 */
export async function findDuplicates(parsedEvent: ParsedEvent, clubId: string): Promise<Event[]> {
  const eventDate = new Date(parsedEvent.date);
  const dayBefore = new Date(eventDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(eventDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const { data: candidates } = await supabase
    .from('events')
    .select('*')
    .eq('club_id', clubId)
    .in('status', ['confirmed', 'pending'])
    .gte('date', dayBefore.toISOString().split('T')[0])
    .lte('date', dayAfter.toISOString().split('T')[0]);

  if (!candidates || candidates.length === 0) return [];

  return candidates.filter(evt => titleSimilarity(evt.title, parsedEvent.title) > 0.7);
}

/**
 * Calculate title similarity using normalized Levenshtein distance.
 * Returns 0.0 (completely different) to 1.0 (identical).
 */
function titleSimilarity(a: string, b: string): number {
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();

  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  const dist = distance(normA, normB);
  return 1.0 - dist / maxLen;
}
