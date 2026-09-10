import { Prisma } from '@prisma/client';

export type WorkingHoursResponse = Prisma.WorkingHoursGetPayload<
  Record<string, never>
>;

export type AvailabilityExceptionResponse =
  Prisma.AvailabilityExceptionGetPayload<Record<string, never>>;

/** One free slot as returned on the wire (ISO-8601 strings). */
export type PublicSlotItem = {
  startsAt: string;
  endsAt: string;
};

/**
 * Wire contract for `GET /availability/public/:slug/slots`.
 * Not a Prisma model — aligned to `AvailabilityService.getPublicSlots`.
 */
export type PublicSlotsResponse = {
  date: string;
  timezone: string;
  serviceId: string;
  durationMin: number;
  bufferMin: number;
  slots: PublicSlotItem[];
};
