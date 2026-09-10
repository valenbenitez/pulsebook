import { rangesOverlapWithBuffer, addMinutes } from '../overlap.util';

describe('overlap.util', () => {
  describe('addMinutes', () => {
    it('adds duration in minutes', () => {
      const start = new Date('2026-09-10T12:00:00.000Z');
      expect(addMinutes(start, 30).toISOString()).toBe(
        '2026-09-10T12:30:00.000Z',
      );
    });
  });

  describe('rangesOverlapWithBuffer', () => {
    // Existing appointment 12:00–13:00
    const existingStart = new Date('2026-09-10T12:00:00.000Z');
    const existingEnd = new Date('2026-09-10T13:00:00.000Z');

    it('detects direct overlap with zero buffer', () => {
      expect(
        rangesOverlapWithBuffer(
          new Date('2026-09-10T12:30:00.000Z'),
          new Date('2026-09-10T13:30:00.000Z'),
          existingStart,
          existingEnd,
          0,
        ),
      ).toBe(true);
    });

    it('allows adjacent appointments with zero buffer', () => {
      expect(
        rangesOverlapWithBuffer(
          new Date('2026-09-10T13:00:00.000Z'),
          new Date('2026-09-10T14:00:00.000Z'),
          existingStart,
          existingEnd,
          0,
        ),
      ).toBe(false);
    });

    it('blocks candidate starting within bufferMin after existing end', () => {
      expect(
        rangesOverlapWithBuffer(
          new Date('2026-09-10T13:10:00.000Z'),
          new Date('2026-09-10T13:40:00.000Z'),
          existingStart,
          existingEnd,
          15,
        ),
      ).toBe(true);
    });

    it('allows candidate ending exactly at existing start (no pre-buffer)', () => {
      // Same asymmetry as computeFreeSlots: buffer only after existing endsAt.
      // Existing 13:10–13:40; candidate 12:00–13:00 with buffer 15 → ok.
      expect(
        rangesOverlapWithBuffer(
          new Date('2026-09-10T12:00:00.000Z'),
          new Date('2026-09-10T13:00:00.000Z'),
          new Date('2026-09-10T13:10:00.000Z'),
          new Date('2026-09-10T13:40:00.000Z'),
          15,
        ),
      ).toBe(false);
    });

    it('allows slot exactly at existing end + bufferMin', () => {
      expect(
        rangesOverlapWithBuffer(
          new Date('2026-09-10T13:15:00.000Z'),
          new Date('2026-09-10T13:45:00.000Z'),
          existingStart,
          existingEnd,
          15,
        ),
      ).toBe(false);
    });
  });
});
