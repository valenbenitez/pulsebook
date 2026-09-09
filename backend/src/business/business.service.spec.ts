import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfessionType, Prisma } from '@prisma/client';
import { BusinessService } from './business.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BusinessService', () => {
  let service: BusinessService;
  let prisma: {
    business: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const business = {
    id: 'biz-1',
    ownerId: 'user-1',
    name: 'Pro Shop',
    slug: 'pro-shop',
    timezone: 'America/Argentina/Buenos_Aires',
    professionType: ProfessionType.BARBER,
    bufferMin: 15,
  };

  beforeEach(() => {
    prisma = {
      business: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new BusinessService(prisma as unknown as PrismaService);
  });

  describe('getByOwnerId', () => {
    it('returns business for owner', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      await expect(service.getByOwnerId('user-1')).resolves.toEqual(business);
      expect(prisma.business.findUnique).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
      });
    });

    it('throws NotFound when missing', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.getByOwnerId('user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateByOwnerId', () => {
    it('updates only provided fields scoped by ownerId', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      const updated = { ...business, name: 'New Name', bufferMin: 20 };
      prisma.business.update.mockResolvedValue(updated);

      await expect(
        service.updateByOwnerId('user-1', { name: 'New Name', bufferMin: 20 }),
      ).resolves.toEqual(updated);

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
        data: { name: 'New Name', bufferMin: 20 },
      });
    });

    it('throws ConflictException on duplicate slug', async () => {
      prisma.business.findUnique.mockResolvedValue(business);
      prisma.business.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.updateByOwnerId('user-1', { slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
