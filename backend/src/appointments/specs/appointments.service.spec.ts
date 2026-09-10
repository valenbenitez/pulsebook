import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { AvailabilityService } from '../../availability/availability.service';
import { BusinessService } from '../../business/business.service';
import { ClientsService } from '../../clients/clients.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsService } from '../appointments.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: {
    client: { findFirst: jest.Mock };
    service: { findFirst: jest.Mock };
    appointment: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    business: { findUnique: jest.Mock };
  };
  let businessService: { getByOwnerId: jest.Mock };
  let clientsService: { findOrCreate: jest.Mock };
  let availabilityService: { resolveWindowsForDate: jest.Mock };

  const business = {
    id: 'biz-1',
    ownerId: 'user-1',
    slug: 'pro-shop',
    timezone: 'UTC',
    bufferMin: 15,
  };

  const client = {
    id: 'client-1',
    businessId: 'biz-1',
    name: 'Ana',
  };

  const svc = {
    id: 'svc-1',
    businessId: 'biz-1',
    name: 'Cut',
    durationMin: 30,
    isActive: true,
  };

  const appointment = {
    id: 'appt-1',
    businessId: 'biz-1',
    clientId: 'client-1',
    serviceId: 'svc-1',
    startsAt: new Date('2026-09-14T12:00:00.000Z'),
    endsAt: new Date('2026-09-14T12:30:00.000Z'),
    status: AppointmentStatus.PENDING,
    notes: null,
  };

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
      appointment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      business: { findUnique: jest.fn() },
    };
    businessService = {
      getByOwnerId: jest.fn().mockResolvedValue(business),
    };
    clientsService = {
      findOrCreate: jest.fn(),
    };
    availabilityService = {
      resolveWindowsForDate: jest
        .fn()
        .mockResolvedValue([{ startTime: '09:00', endTime: '18:00' }]),
    };
    service = new AppointmentsService(
      prisma as unknown as PrismaService,
      businessService as unknown as BusinessService,
      clientsService as unknown as ClientsService,
      availabilityService as unknown as AvailabilityService,
    );
  });

  describe('create', () => {
    it('computes endsAt from service.durationMin and defaults status PENDING', async () => {
      prisma.client.findFirst.mockResolvedValue(client);
      prisma.service.findFirst.mockResolvedValue(svc);
      prisma.appointment.findMany.mockResolvedValue([]);
      prisma.appointment.create.mockResolvedValue(appointment);

      await expect(
        service.create('user-1', {
          clientId: 'client-1',
          serviceId: 'svc-1',
          startsAt: '2026-09-14T12:00:00.000Z',
        }),
      ).resolves.toEqual(appointment);

      expect(prisma.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz-1',
          clientId: 'client-1',
          serviceId: 'svc-1',
          startsAt: new Date('2026-09-14T12:00:00.000Z'),
          endsAt: new Date('2026-09-14T12:30:00.000Z'),
          status: AppointmentStatus.PENDING,
        }),
      });
    });

    it('rejects overlap with PENDING/CONFIRMED considering bufferMin', async () => {
      prisma.client.findFirst.mockResolvedValue(client);
      prisma.service.findFirst.mockResolvedValue(svc);
      prisma.appointment.findMany.mockResolvedValue([
        {
          id: 'other',
          startsAt: new Date('2026-09-14T12:00:00.000Z'),
          endsAt: new Date('2026-09-14T12:30:00.000Z'),
        },
      ]);

      await expect(
        service.create('user-1', {
          clientId: 'client-1',
          serviceId: 'svc-1',
          startsAt: '2026-09-14T12:40:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.appointment.create).not.toHaveBeenCalled();
    });

    it('rejects outside working hours', async () => {
      prisma.client.findFirst.mockResolvedValue(client);
      prisma.service.findFirst.mockResolvedValue(svc);
      availabilityService.resolveWindowsForDate.mockResolvedValue([
        { startTime: '09:00', endTime: '11:00' },
      ]);

      await expect(
        service.create('user-1', {
          clientId: 'client-1',
          serviceId: 'svc-1',
          startsAt: '2026-09-14T12:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound for missing client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          clientId: 'missing',
          serviceId: 'svc-1',
          startsAt: '2026-09-14T12:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll / findOne', () => {
    it('lists with optional date range and status filters', async () => {
      prisma.appointment.findMany.mockResolvedValue([appointment]);

      await expect(
        service.findAll('user-1', {
          from: '2026-09-14T00:00:00.000Z',
          to: '2026-09-15T00:00:00.000Z',
          status: AppointmentStatus.PENDING,
        }),
      ).resolves.toEqual([appointment]);

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-1',
          status: AppointmentStatus.PENDING,
          startsAt: {
            gte: new Date('2026-09-14T00:00:00.000Z'),
            lt: new Date('2026-09-15T00:00:00.000Z'),
          },
        },
        orderBy: { startsAt: 'asc' },
      });
    });

    it('throws NotFound for cross-tenant or missing appointment', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne('user-1', 'other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('allows CANCELLED without overlap recheck and frees the slot', async () => {
      prisma.appointment.findFirst.mockResolvedValue(appointment);
      const cancelled = {
        ...appointment,
        status: AppointmentStatus.CANCELLED,
      };
      prisma.appointment.update.mockResolvedValue(cancelled);

      await expect(
        service.update('user-1', 'appt-1', {
          status: AppointmentStatus.CANCELLED,
        }),
      ).resolves.toEqual(cancelled);

      expect(prisma.appointment.findMany).not.toHaveBeenCalled();
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-1' },
        data: { status: AppointmentStatus.CANCELLED },
      });
    });

    it('revalidates overlap on reschedule', async () => {
      prisma.appointment.findFirst.mockResolvedValue(appointment);
      prisma.service.findFirst.mockResolvedValue(svc);
      prisma.appointment.findMany.mockResolvedValue([
        {
          id: 'blocker',
          startsAt: new Date('2026-09-14T14:00:00.000Z'),
          endsAt: new Date('2026-09-14T14:30:00.000Z'),
        },
      ]);

      await expect(
        service.update('user-1', 'appt-1', {
          startsAt: '2026-09-14T14:10:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('revalidates when reactivating CANCELLED into PENDING', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        ...appointment,
        status: AppointmentStatus.CANCELLED,
      });
      prisma.appointment.findMany.mockResolvedValue([
        {
          id: 'blocker',
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
        },
      ]);

      await expect(
        service.update('user-1', 'appt-1', {
          status: AppointmentStatus.PENDING,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('createPublic', () => {
    it('findOrCreate client and creates PENDING appointment', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue(svc);
      prisma.appointment.findMany.mockResolvedValue([]);
      clientsService.findOrCreate.mockResolvedValue(client);
      prisma.appointment.create.mockResolvedValue(appointment);

      await expect(
        service.createPublic('pro-shop', {
          serviceId: 'svc-1',
          startsAt: '2026-09-14T12:00:00.000Z',
          name: 'Ana',
          email: 'ana@example.com',
        }),
      ).resolves.toEqual(appointment);

      expect(clientsService.findOrCreate).toHaveBeenCalledWith('biz-1', {
        name: 'Ana',
        email: 'ana@example.com',
        phone: undefined,
        notes: undefined,
      });
      expect(prisma.appointment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: AppointmentStatus.PENDING,
        }),
      });
    });

    it('returns 409 Conflict when slot occupied', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue(svc);
      prisma.appointment.findMany.mockResolvedValue([
        {
          id: 'taken',
          startsAt: new Date('2026-09-14T12:00:00.000Z'),
          endsAt: new Date('2026-09-14T12:30:00.000Z'),
        },
      ]);

      await expect(
        service.createPublic('pro-shop', {
          serviceId: 'svc-1',
          startsAt: '2026-09-14T12:00:00.000Z',
          name: 'Ana',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('dateYmdInTimeZone', () => {
    it('formats calendar date in the given zone', () => {
      expect(
        service.dateYmdInTimeZone(
          new Date('2026-09-14T03:00:00.000Z'),
          'America/Argentina/Buenos_Aires',
        ),
      ).toBe('2026-09-14');
    });
  });
});
