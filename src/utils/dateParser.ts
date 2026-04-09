/**
 * Resolve relative date expressions to absolute YYYY-MM-DD strings.
 * Uses IST (Asia/Kolkata) timezone.
 */
export function resolveRelativeDate(input: string): string | null {
  const now = new Date();
  // Convert to IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);

  const lower = input.toLowerCase().trim();

  if (lower === 'today') {
    return formatDate(istNow);
  }

  if (lower === 'tomorrow') {
    const d = new Date(istNow);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }

  if (lower === 'yesterday') {
    const d = new Date(istNow);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }

  // "this <dayOfWeek>" or "next <dayOfWeek>" or "coming <dayOfWeek>"
  const dayMatch = lower.match(/(?:this|next|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (dayMatch) {
    const targetDay = getDayIndex(dayMatch[1]);
    const currentDay = istNow.getUTCDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    if (lower.startsWith('next') && daysAhead <= 7) daysAhead += 7;
    const d = new Date(istNow);
    d.setDate(d.getDate() + daysAhead);
    return formatDate(d);
  }

  // "in X days"
  const inDaysMatch = lower.match(/in\s+(\d+)\s+days?/);
  if (inDaysMatch) {
    const d = new Date(istNow);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1]));
    return formatDate(d);
  }

  return null; // couldn't parse
}

/**
 * Get the current date in IST as YYYY-MM-DD.
 */
export function getTodayIST(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA gives YYYY-MM-DD
}

/**
 * Add calendar days to a YYYY-MM-DD string using pure Gregorian math (UTC components).
 * IMPORTANT: Do not use Date#getDate() in the server timezone — on UTC hosts that made
 * "tomorrow" identical to "today" for IST users.
 */
export function addCalendarDays(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Day of week (0=Sun..6=Sat) for a calendar date as observed in IST. */
function getWeekdayIST(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00+05:30`).getDay();
}

/**
 * Get dates for time ranges (all in IST calendar terms via getTodayIST).
 */
export function getDateRange(type: 'today' | 'tomorrow' | 'this_week' | 'this_weekend'): { start: string; end: string } {
  const todayStr = getTodayIST();

  switch (type) {
    case 'today':
      return { start: todayStr, end: todayStr };

    case 'tomorrow': {
      const next = addCalendarDays(todayStr, 1);
      return { start: next, end: next };
    }

    case 'this_week': {
      return { start: todayStr, end: addCalendarDays(todayStr, 6) };
    }

    case 'this_weekend': {
      const w = getWeekdayIST(todayStr);
      if (w === 0) {
        const sat = addCalendarDays(todayStr, -1);
        return { start: sat, end: todayStr };
      }
      if (w === 6) {
        return { start: todayStr, end: addCalendarDays(todayStr, 1) };
      }
      const daysToSat = (6 - w + 7) % 7;
      const sat = addCalendarDays(todayStr, daysToSat);
      return { start: sat, end: addCalendarDays(sat, 1) };
    }
  }
}

/**
 * Format a human-readable date from YYYY-MM-DD.
 */
export function formatHumanDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00+05:30');
  const today = getTodayIST();
  const tomorrow = getDateRange('tomorrow').start;

  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';

  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format time from HH:MM:SS to human readable.
 */
export function formatHumanTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayIndex(day: string): number {
  const days: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  return days[day] ?? 0;
}
