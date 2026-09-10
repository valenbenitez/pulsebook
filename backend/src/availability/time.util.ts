const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidHhMm(value: string): boolean {
  return TIME_RE.test(value);
}

export function hhMmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** Lexicographic HH:mm compare is valid for zero-padded times. */
export function isStartBeforeEnd(startTime: string, endTime: string): boolean {
  return startTime < endTime;
}

type TzParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getTzParts(date: Date, timeZone: string): TzParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  let hour = Number(map.hour);
  // Some engines emit "24" for midnight.
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset (ms) such that localWall = utcInstant + offset in the given zone. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTzParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

/**
 * Convert a wall-clock date (`YYYY-MM-DD`) + time (`HH:mm`) in `timeZone` to UTC.
 */
export function zonedDateTimeToUtc(
  dateYmd: string,
  hhmm: string,
  timeZone: string,
): Date {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(y, mo - 1, d, hh, mm, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  let result = new Date(utcGuess.getTime() - offset);
  // Second pass for DST transition edge cases.
  const offset2 = getTimeZoneOffsetMs(result, timeZone);
  if (offset2 !== offset) {
    result = new Date(utcGuess.getTime() - offset2);
  }
  return result;
}

const WEEKDAY_TO_DOW: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** JS dayOfWeek (0=Sun … 6=Sat) for a calendar date in the business timezone. */
export function dayOfWeekInTimeZone(dateYmd: string, timeZone: string): number {
  const noon = zonedDateTimeToUtc(dateYmd, '12:00', timeZone);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(noon);
  const dow = WEEKDAY_TO_DOW[weekday];
  if (dow === undefined) {
    throw new Error(`Unexpected weekday token: ${weekday}`);
  }
  return dow;
}

export function addCalendarDays(dateYmd: string, days: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export type TimeWindow = { startTime: string; endTime: string };

export type SlotInterval = { startsAt: Date; endsAt: Date };

export type BusyInterval = { startsAt: Date; endsAt: Date };

/**
 * Build free slots inside windows, excluding busy intervals expanded by buffer after end.
 * Candidate starts advance by durationMin (non-overlapping adjacent slots).
 */
export function computeFreeSlots(params: {
  windows: TimeWindow[];
  dateYmd: string;
  timeZone: string;
  durationMin: number;
  bufferMin: number;
  busy: BusyInterval[];
}): SlotInterval[] {
  const { windows, dateYmd, timeZone, durationMin, bufferMin, busy } = params;
  if (durationMin <= 0) return [];

  const durationMs = durationMin * 60_000;
  const bufferMs = bufferMin * 60_000;
  const stepMs = durationMs;

  const blocked = busy.map((b) => ({
    start: b.startsAt.getTime(),
    end: b.endsAt.getTime() + bufferMs,
  }));

  const slots: SlotInterval[] = [];

  for (const window of windows) {
    if (!isStartBeforeEnd(window.startTime, window.endTime)) continue;

    const windowStart = zonedDateTimeToUtc(
      dateYmd,
      window.startTime,
      timeZone,
    ).getTime();
    const windowEnd = zonedDateTimeToUtc(
      dateYmd,
      window.endTime,
      timeZone,
    ).getTime();

    for (
      let t = windowStart;
      t + durationMs <= windowEnd;
      t += stepMs
    ) {
      const end = t + durationMs;
      const overlaps = blocked.some((b) => t < b.end && end > b.start);
      if (overlaps) continue;
      slots.push({ startsAt: new Date(t), endsAt: new Date(end) });
    }
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return slots;
}
