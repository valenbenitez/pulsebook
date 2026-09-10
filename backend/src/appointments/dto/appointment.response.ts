import { Prisma } from '@prisma/client';

/**
 * Wire contract for Appointment endpoints (auth CRUD + public book).
 *
 * Real queries in create / findAll / findOne / update / createPublic use no
 * `include` — only Appointment scalars (clientId / serviceId FKs, not nested
 * client or service). Documented as empty GetPayload args.
 *
 * Public `POST /appointments/public/:slug` returns the same shape as private
 * create/get/update — no separate public type.
 */
export type AppointmentResponse = Prisma.AppointmentGetPayload<
  Record<string, never>
>;

export type AppointmentListResponse = AppointmentResponse[];
