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
 * Get dates for time ranges.
 */
export function getDateRange(type: 'today' | 'tomorrow' | 'this_week' | 'this_weekend'): { start: string; end: string } {
  const today = new Date(getTodayIST() + 'T00:00:00+05:30');

  switch (type) {
    case 'today':
      return { start: getTodayIST(), end: getTodayIST() };

    case 'tomorrow': {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      const s = formatDate(d);
      return { start: s, end: s };
    }

    case 'this_week': {
      const end = new Date(today);
      end.setDate(end.getDate() + 6);
      return { start: getTodayIST(), end: formatDate(end) };
    }

    case 'this_weekend': {
      const dayOfWeek = today.getDay();
      const saturdayOffset = (6 - dayOfWeek + 7) % 7 || 7;
      const saturday = new Date(today);
      saturday.setDate(saturday.getDate() + saturdayOffset);
      const sunday = new Date(saturday);
      sunday.setDate(sunday.getDate() + 1);
      return { start: formatDate(saturday), end: formatDate(sunday) };
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
