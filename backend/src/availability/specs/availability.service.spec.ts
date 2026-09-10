import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { BusinessService } from '../../business/business.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: {
    workingHours: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    availabilityException: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    business: { findUnique: jest.Mock };
    service: { findFirst: jest.Mock };
    appointment: { findMany: jest.Mock };
  };
  let businessService: { getByOwnerId: jest.Mock };

  const business = {
    id: 'biz-1',
    ownerId: 'user-1',
    slug: 'pro-shop',
    timezone: 'America/Argentina/Buenos_Aires',
    bufferMin: 15,
  };

  beforeEach(() => {
    prisma = {
      workingHours: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      availabilityException: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      business: { findUnique: jest.fn() },
      service: { findFirst: jest.fn() },
      appointment: { findMany: jest.fn() },
    };
    businessService = {
      getByOwnerId: jest.fn().mockResolvedValue(business),
    };
    service = new AvailabilityService(
      prisma as unknown as PrismaService,
      businessService as unknown as BusinessService,
    );
  });

  describe('working hours CRUD', () => {
    it('creates hours scoped to owner business', async () => {
      const row = {
        id: 'wh-1',
        businessId: 'biz-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      };
      prisma.workingHours.create.mockResolvedValue(row);

      await expect(
        service.createWorkingHours('user-1', {
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
        }),
      ).resolves.toEqual(row);

      expect(prisma.workingHours.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz-1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
        },
      });
    });

    it('rejects update that would invert start/end', async () => {
      prisma.workingHours.findFirst.mockResolvedValue({
        id: 'wh-1',
        businessId: 'biz-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      });

      await expect(
        service.updateWorkingHours('user-1', 'wh-1', { startTime: '18:00' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.workingHours.update).not.toHaveBeenCalled();
    });

    it('rejects invalid HH:mm on partial startTime update', async () => {
      prisma.workingHours.findFirst.mockResolvedValue({
        id: 'wh-1',
        businessId: 'biz-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
      });

      await expect(
        service.updateWorkingHours('user-1', 'wh-1', { startTime: '10:99' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.workingHours.update).not.toHaveBeenCalled();
    });

    it('throws NotFound for cross-tenant hours', async () => {
      prisma.workingHours.findFirst.mockResolvedValue(null);
      await expect(
        service.getWorkingHoursById('user-1', 'other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('exceptions CRUD', () => {
    it('requires start/end when isClosed=false', async () => {
      await expect(
        service.createException('user-1', {
          date: '2026-03-16',
          isClosed: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.availabilityException.create).not.toHaveBeenCalled();
    });

    it('ignores window when isClosed=true', async () => {
      const row = {
        id: 'ex-1',
        businessId: 'biz-1',
        date: new Date('2026-03-16T00:00:00.000Z'),
        isClosed: true,
        startTime: null,
        endTime: null,
        reason: 'Holiday',
      };
      prisma.availabilityException.create.mockResolvedValue(row);

      await expect(
        service.createException('user-1', {
          date: '2026-03-16',
          isClosed: true,
          startTime: '10:00',
          endTime: '12:00',
          reason: 'Holiday',
        }),
      ).resolves.toEqual(row);

      expect(prisma.availabilityException.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz-1',
          date: new Date('2026-03-16T00:00:00.000Z'),
          isClosed: true,
          startTime: null,
          endTime: null,
          reason: 'Holiday',
        },
      });
    });

    it('maps unique (businessId, date) to ConflictException', async () => {
      prisma.availabilityException.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.createException('user-1', {
          date: '2026-03-16',
          isClosed: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getPublicSlots', () => {
    it('returns empty list for closed exception day', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        businessId: 'biz-1',
        durationMin: 30,
        isActive: true,
      });
      prisma.availabilityException.findUnique.mockResolvedValue({
        id: 'ex-1',
        isClosed: true,
        startTime: null,
        endTime: null,
      });

      const result = await service.getPublicSlots(
        'pro-shop',
        'svc-1',
        '2026-03-16',
      );

      expect(result.slots).toEqual([]);
      expect(prisma.appointment.findMany).not.toHaveBeenCalled();
    });

    it('uses working hours, excludes PENDING/CONFIRMED with buffer', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        businessId: 'biz-1',
        durationMin: 30,
        isActive: true,
      });
      prisma.availabilityException.findUnique.mockResolvedValue(null);
      // 2026-03-16 is Monday → dayOfWeek 1
      prisma.workingHours.findMany.mockResolvedValue([
        {
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '11:00',
        },
      ]);
      prisma.appointment.findMany.mockResolvedValue([
        {
          startsAt: new Date('2026-03-16T12:00:00.000Z'), // 09:00 BA
          endsAt: new Date('2026-03-16T12:30:00.000Z'),
        },
      ]);

      const result = await service.getPublicSlots(
        'pro-shop',
        'svc-1',
        '2026-03-16',
      );

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
            },
          }),
        }),
      );

      const starts = result.slots.map((s) => s.startsAt);
      expect(starts).not.toContain('2026-03-16T12:00:00.000Z');
      expect(starts).not.toContain('2026-03-16T12:30:00.000Z');
      expect(starts).toContain('2026-03-16T13:00:00.000Z');
    });

    it('throws NotFound for unknown slug or inactive service', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(
        service.getPublicSlots('missing', 'svc-1', '2026-03-16'),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue(null);
      await expect(
        service.getPublicSlots('pro-shop', 'svc-x', '2026-03-16'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
