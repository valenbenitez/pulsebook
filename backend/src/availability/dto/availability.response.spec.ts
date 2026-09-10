import { Prisma } from '@prisma/client';
import type {
  AvailabilityExceptionResponse,
  PublicSlotItem,
  PublicSlotsResponse,
  WorkingHoursResponse,
} from './availability.response';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

describe('WorkingHoursResponse', () => {
  it('matches Prisma WorkingHours scalar payload without relations', () => {
    type Expected = Prisma.WorkingHoursGetPayload<Record<string, never>>;
    const equal: AssertEqual<WorkingHoursResponse, Expected> = true;
    expect(equal).toBe(true);

    const sample: WorkingHoursResponse = {
      id: 'wh-1',
      businessId: 'biz-1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
    };

    expect(sample).toEqual(
      expect.objectContaining({
        id: 'wh-1',
        businessId: 'biz-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      }),
    );
    expect(Object.keys(sample).sort()).toEqual(
      ['id', 'businessId', 'dayOfWeek', 'startTime', 'endTime'].sort(),
    );
  });
});

describe('AvailabilityExceptionResponse', () => {
  it('matches Prisma AvailabilityException scalar payload without relations', () => {
    type Expected = Prisma.AvailabilityExceptionGetPayload<
      Record<string, never>
    >;
    const equal: AssertEqual<AvailabilityExceptionResponse, Expected> = true;
    expect(equal).toBe(true);

    const sample: AvailabilityExceptionResponse = {
      id: 'ex-1',
      businessId: 'biz-1',
      date: new Date('2026-03-16T00:00:00.000Z'),
      isClosed: false,
      startTime: '10:00',
      endTime: '14:00',
      reason: 'Half day',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    expect(sample).toEqual(
      expect.objectContaining({
        id: 'ex-1',
        businessId: 'biz-1',
        isClosed: false,
        startTime: '10:00',
        endTime: '14:00',
        reason: 'Half day',
      }),
    );
    expect(Object.keys(sample).sort()).toEqual(
      [
        'id',
        'businessId',
        'date',
        'isClosed',
        'startTime',
        'endTime',
        'reason',
        'createdAt',
      ].sort(),
    );
  });
});

describe('PublicSlotsResponse', () => {
  it('types public slots payload with ISO slot strings and metadata fields', () => {
    type Expected = {
      date: string;
      timezone: string;
      serviceId: string;
      durationMin: number;
      bufferMin: number;
      slots: PublicSlotItem[];
    };
    const equal: AssertEqual<PublicSlotsResponse, Expected> = true;
    expect(equal).toBe(true);

    type SlotStartsAtIsString = PublicSlotItem['startsAt'] extends string
      ? true
      : false;
    type SlotEndsAtIsString = PublicSlotItem['endsAt'] extends string
      ? true
      : false;
    const startsAtIsString: SlotStartsAtIsString = true;
    const endsAtIsString: SlotEndsAtIsString = true;
    expect(startsAtIsString).toBe(true);
    expect(endsAtIsString).toBe(true);

    const sample: PublicSlotsResponse = {
      date: '2026-03-16',
      timezone: 'America/Argentina/Buenos_Aires',
      serviceId: 'svc-1',
      durationMin: 30,
      bufferMin: 15,
      slots: [
        {
          startsAt: '2026-03-16T12:00:00.000Z',
          endsAt: '2026-03-16T12:30:00.000Z',
        },
      ],
    };

    expect(sample.slots[0].startsAt).toBe('2026-03-16T12:00:00.000Z');
    expect(typeof sample.slots[0].startsAt).toBe('string');
    expect(Object.keys(sample).sort()).toEqual(
      [
        'date',
        'timezone',
        'serviceId',
        'durationMin',
        'bufferMin',
        'slots',
      ].sort(),
    );
    expect(Object.keys(sample.slots[0]).sort()).toEqual(
      ['startsAt', 'endsAt'].sort(),
    );
  });
});
