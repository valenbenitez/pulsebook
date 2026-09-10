import {
  addCalendarDays,
  computeFreeSlots,
  dayOfWeekInTimeZone,
  isStartBeforeEnd,
  isValidHhMm,
  zonedDateTimeToUtc,
} from './time.util';

describe('time.util', () => {
  describe('isValidHhMm / isStartBeforeEnd', () => {
    it('accepts valid HH:mm and rejects invalid', () => {
      expect(isValidHhMm('09:00')).toBe(true);
      expect(isValidHhMm('23:59')).toBe(true);
      expect(isValidHhMm('24:00')).toBe(false);
      expect(isValidHhMm('9:00')).toBe(false);
    });

    it('requires start < end', () => {
      expect(isStartBeforeEnd('09:00', '17:00')).toBe(true);
      expect(isStartBeforeEnd('09:00', '09:00')).toBe(false);
      expect(isStartBeforeEnd('18:00', '09:00')).toBe(false);
    });
  });

  describe('timezone conversion', () => {
    it('maps Buenos Aires wall time to correct UTC offset (UTC-3)', () => {
      // 2026-03-10 is outside AR DST historical changes; AR is UTC-3 year-round.
      const utc = zonedDateTimeToUtc(
        '2026-03-10',
        '09:00',
        'America/Argentina/Buenos_Aires',
      );
      expect(utc.toISOString()).toBe('2026-03-10T12:00:00.000Z');
    });

    it('computes dayOfWeek in business timezone across UTC midnight', () => {
      // 2026-03-14 22:00 UTC is still Saturday in BA (UTC-3 → 19:00 Sat)
      // Calendar date 2026-03-15 in BA is Sunday (0)
      expect(
        dayOfWeekInTimeZone('2026-03-15', 'America/Argentina/Buenos_Aires'),
      ).toBe(0);
      // 2026-03-16 is Monday
      expect(
        dayOfWeekInTimeZone('2026-03-16', 'America/Argentina/Buenos_Aires'),
      ).toBe(1);
    });

    it('addCalendarDays rolls months', () => {
      expect(addCalendarDays('2026-01-31', 1)).toBe('2026-02-01');
    });
  });

  describe('computeFreeSlots', () => {
    const tz = 'America/Argentina/Buenos_Aires';
    const dateYmd = '2026-03-16'; // Monday

    it('returns empty when day has no windows (closed)', () => {
      const slots = computeFreeSlots({
        windows: [],
        dateYmd,
        timeZone: tz,
        durationMin: 30,
        bufferMin: 15,
        busy: [],
      });
      expect(slots).toEqual([]);
    });

    it('generates non-overlapping slots inside working window', () => {
      const slots = computeFreeSlots({
        windows: [{ startTime: '09:00', endTime: '11:00' }],
        dateYmd,
        timeZone: tz,
        durationMin: 30,
        bufferMin: 15,
        busy: [],
      });
      // 09:00-09:30, 09:30-10:00, 10:00-10:30, 10:30-11:00
      expect(slots).toHaveLength(4);
      expect(slots[0].startsAt.toISOString()).toBe('2026-03-16T12:00:00.000Z');
      expect(slots[0].endsAt.toISOString()).toBe('2026-03-16T12:30:00.000Z');
      expect(slots[3].startsAt.toISOString()).toBe('2026-03-16T13:30:00.000Z');
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].startsAt.getTime()).toBeGreaterThanOrEqual(
          slots[i - 1].endsAt.getTime(),
        );
      }
    });

    it('excludes slots that overlap appointments plus bufferMin after end', () => {
      // Appointment 09:00-09:30 BA (= 12:00-12:30Z); buffer 15 → blocks until 09:45 BA
      const busyStart = zonedDateTimeToUtc(dateYmd, '09:00', tz);
      const busyEnd = zonedDateTimeToUtc(dateYmd, '09:30', tz);

      const slots = computeFreeSlots({
        windows: [{ startTime: '09:00', endTime: '11:00' }],
        dateYmd,
        timeZone: tz,
        durationMin: 30,
        bufferMin: 15,
        busy: [{ startsAt: busyStart, endsAt: busyEnd }],
      });

      const starts = slots.map((s) => s.startsAt.toISOString());
      expect(starts).not.toContain('2026-03-16T12:00:00.000Z'); // 09:00 overlaps appt
      expect(starts).not.toContain('2026-03-16T12:30:00.000Z'); // 09:30 starts inside buffer
      expect(starts).toContain('2026-03-16T13:00:00.000Z'); // 10:00 OK (09:45+)
    });

    it('respects exception-style shortened window', () => {
      const slots = computeFreeSlots({
        windows: [{ startTime: '10:00', endTime: '11:00' }],
        dateYmd,
        timeZone: tz,
        durationMin: 30,
        bufferMin: 0,
        busy: [],
      });
      expect(slots).toHaveLength(2);
      expect(slots[0].startsAt.toISOString()).toBe('2026-03-16T13:00:00.000Z');
    });

    it('does not emit slots that would overrun the window', () => {
      const slots = computeFreeSlots({
        windows: [{ startTime: '09:00', endTime: '09:45' }],
        dateYmd,
        timeZone: tz,
        durationMin: 30,
        bufferMin: 0,
        busy: [],
      });
      expect(slots).toHaveLength(1);
      expect(slots[0].endsAt.toISOString()).toBe('2026-03-16T12:30:00.000Z');
    });
  });
});
