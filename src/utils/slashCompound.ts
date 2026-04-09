/**
 * Parse combined category + time shortcuts, e.g. /sports today, /tech this week, /sports /week
 */

export type TimePreset = 'today' | 'tomorrow' | 'this_week' | 'this_weekend';

/**
 * Normalize messy user input: /sports this /week → /sports this week
 */
export function normalizeSlashCompound(text: string): string {
  return text
    .replace(/\s+\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * If the message is /{category} {time}, return category + preset. Otherwise null.
 */
export function parseCategorySlashTime(
  normalizedLower: string,
  categorySlugSet: Set<string>
): { category: string; preset: TimePreset } | null {
  const s = normalizeSlashCompound(normalizedLower);

  const todayTom = /^\/([a-z0-9_-]+)\s+(today|tomorrow)\s*$/i.exec(s);
  if (todayTom && categorySlugSet.has(todayTom[1].toLowerCase())) {
    const preset = todayTom[2].toLowerCase() === 'today' ? 'today' : 'tomorrow';
    return { category: todayTom[1].toLowerCase(), preset };
  }

  const week = /^\/([a-z0-9_-]+)\s+(this\s*week|thisweek|week)\s*$/i.exec(s);
  if (week && categorySlugSet.has(week[1].toLowerCase())) {
    return { category: week[1].toLowerCase(), preset: 'this_week' };
  }

  const wend = /^\/([a-z0-9_-]+)\s+(this\s*weekend|thisweekend|weekend)\s*$/i.exec(s);
  if (wend && categorySlugSet.has(wend[1].toLowerCase())) {
    return { category: wend[1].toLowerCase(), preset: 'this_weekend' };
  }

  return null;
}
