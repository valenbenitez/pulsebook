import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  let service: ServicesService;
  let prisma: {
    business: { findUnique: jest.Mock };
    service: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  const business = { id: 'biz-1' };
  const ownedService = {
    id: 'svc-1',
    businessId: 'biz-1',
    name: 'Cut',
    description: null,
    durationMin: 30,
    price: new Prisma.Decimal(25),
    isActive: true,
  };

  beforeEach(() => {
    prisma = {
      business: { findUnique: jest.fn() },
      service: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ServicesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates service linked to owner business', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.create.mockResolvedValue(ownedService);

      await expect(
        service.create('user-1', {
          name: 'Cut',
          durationMin: 30,
          price: 25,
        }),
      ).resolves.toEqual(ownedService);

      expect(prisma.business.findUnique).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
        select: { id: true },
      });
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz-1',
          name: 'Cut',
          description: undefined,
          durationMin: 30,
          price: new Prisma.Decimal(25),
        },
      });
    });

    it('throws NotFound when owner has no business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          name: 'Cut',
          durationMin: 30,
          price: 25,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('lists only services for owner business', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findMany.mockResolvedValue([ownedService]);

      await expect(service.list('user-1')).resolves.toEqual([ownedService]);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1' },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('filters by isActive when provided', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findMany.mockResolvedValue([]);

      await service.list('user-1', true);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1', isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('getById', () => {
    it('returns service when owned', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue(ownedService);

      await expect(service.getById('user-1', 'svc-1')).resolves.toEqual(
        ownedService,
      );
      expect(prisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: 'svc-1', businessId: 'biz-1' },
      });
    });

    it('throws NotFound when missing or other business', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.getById('user-1', 'other-svc'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates partial fields without changing businessId', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue(ownedService);
      const updated = {
        ...ownedService,
        name: 'New Cut',
        isActive: false,
        price: new Prisma.Decimal(30),
      };
      prisma.service.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'svc-1', {
          name: 'New Cut',
          price: 30,
          isActive: false,
        }),
      ).resolves.toEqual(updated);

      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        data: {
          name: 'New Cut',
          price: new Prisma.Decimal(30),
          isActive: false,
        },
      });
      const data = prisma.service.update.mock.calls[0][0].data as Record<
        string,
        unknown
      >;
      expect(data).not.toHaveProperty('businessId');
    });

    it('throws NotFound when service not owned', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'svc-x', { name: 'Nope' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });
  });
});
