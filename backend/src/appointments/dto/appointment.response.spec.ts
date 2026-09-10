import { AppointmentStatus, Prisma } from '@prisma/client';
import type {
  AppointmentListResponse,
  AppointmentResponse,
} from './appointment.response';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

describe('AppointmentResponse', () => {
  it('matches Prisma Appointment scalar payload without relations', () => {
    type Expected = Prisma.AppointmentGetPayload<Record<string, never>>;
    const equal: AssertEqual<AppointmentResponse, Expected> = true;
    expect(equal).toBe(true);

    const sample: AppointmentResponse = {
      id: 'appt-1',
      businessId: 'biz-1',
      clientId: 'client-1',
      serviceId: 'svc-1',
      startsAt: new Date('2026-03-10T14:00:00.000Z'),
      endsAt: new Date('2026-03-10T14:30:00.000Z'),
      status: AppointmentStatus.PENDING,
      notes: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    expect(sample).toEqual(
      expect.objectContaining({
        id: 'appt-1',
        businessId: 'biz-1',
        clientId: 'client-1',
        serviceId: 'svc-1',
        status: AppointmentStatus.PENDING,
        notes: null,
      }),
    );
    expect(Object.keys(sample).sort()).toEqual(
      [
        'id',
        'businessId',
        'clientId',
        'serviceId',
        'startsAt',
        'endsAt',
        'status',
        'notes',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });

  it('does not embed client or service relations on the wire type', () => {
    type HasClient = AppointmentResponse extends { client: unknown }
      ? true
      : false;
    type HasService = AppointmentResponse extends { service: unknown }
      ? true
      : false;
    const noClient: AssertEqual<HasClient, false> = true;
    const noService: AssertEqual<HasService, false> = true;
    expect(noClient).toBe(true);
    expect(noService).toBe(true);
  });

  it('AppointmentListResponse is an array of AppointmentResponse', () => {
    type Expected = AppointmentResponse[];
    const equal: AssertEqual<AppointmentListResponse, Expected> = true;
    expect(equal).toBe(true);
  });

  it('documents public book payload as same shape as private (no separate type)', () => {
    // Public createPublic returns the same AppointmentResponse as auth create.
    type PublicBookResponse = AppointmentResponse;
    const equal: AssertEqual<PublicBookResponse, AppointmentResponse> = true;
    expect(equal).toBe(true);
  });
});
