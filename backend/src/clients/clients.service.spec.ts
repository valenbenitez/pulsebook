import { NotFoundException } from '@nestjs/common';
import { BusinessService } from '../business/business.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: {
    client: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let businessService: {
    getByOwnerId: jest.Mock;
  };

  const business = {
    id: 'biz-1',
    ownerId: 'user-1',
    name: 'Pro Shop',
    slug: 'pro-shop',
  };

  const client = {
    id: 'client-1',
    businessId: 'biz-1',
    name: 'Ana',
    email: 'ana@example.com',
    phone: '+549111111',
    notes: null,
  };

  beforeEach(() => {
    prisma = {
      client: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    businessService = {
      getByOwnerId: jest.fn().mockResolvedValue(business),
    };
    service = new ClientsService(
      prisma as unknown as PrismaService,
      businessService as unknown as BusinessService,
    );
  });

  describe('create', () => {
    it('creates client scoped to owner business', async () => {
      prisma.client.create.mockResolvedValue(client);

      await expect(
        service.create('user-1', {
          name: 'Ana',
          email: 'ana@example.com',
          phone: '+549111111',
        }),
      ).resolves.toEqual(client);

      expect(businessService.getByOwnerId).toHaveBeenCalledWith('user-1');
      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz-1',
          name: 'Ana',
          email: 'ana@example.com',
          phone: '+549111111',
          notes: undefined,
        },
      });
    });
  });

  describe('findAll', () => {
    it('lists only clients of the business', async () => {
      prisma.client.findMany.mockResolvedValue([client]);

      await expect(service.findAll('user-1')).resolves.toEqual([client]);
      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('applies optional search across name/email/phone', async () => {
      prisma.client.findMany.mockResolvedValue([client]);

      await expect(service.findAll('user-1', 'ana')).resolves.toEqual([
        client,
      ]);
      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-1',
          OR: [
            { name: { contains: 'ana', mode: 'insensitive' } },
            { email: { contains: 'ana', mode: 'insensitive' } },
            { phone: { contains: 'ana', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns client when in business', async () => {
      prisma.client.findFirst.mockResolvedValue(client);
      await expect(service.findOne('user-1', 'client-1')).resolves.toEqual(
        client,
      );
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'client-1', businessId: 'biz-1' },
      });
    });

    it('throws NotFound for missing or cross-tenant client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne('user-1', 'other-client'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates only provided fields after ownership check', async () => {
      prisma.client.findFirst.mockResolvedValue(client);
      const updated = { ...client, name: 'Ana Updated', notes: 'VIP' };
      prisma.client.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'client-1', {
          name: 'Ana Updated',
          notes: 'VIP',
        }),
      ).resolves.toEqual(updated);

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { name: 'Ana Updated', notes: 'VIP' },
      });
    });

    it('throws NotFound when client is not in business', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      await expect(
        service.update('user-1', 'missing', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.client.update).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreate', () => {
    it('returns existing client matched by email without duplicating', async () => {
      prisma.client.findFirst.mockResolvedValue(client);

      await expect(
        service.findOrCreate('biz-1', {
          name: 'Ana Other',
          email: 'ana@example.com',
          phone: '+549999999',
        }),
      ).resolves.toEqual(client);

      expect(prisma.client.create).not.toHaveBeenCalled();
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          businessId: 'biz-1',
          OR: [
            { email: { equals: 'ana@example.com', mode: 'insensitive' } },
            { phone: '+549999999' },
          ],
        },
      });
    });

    it('returns existing client matched by phone without duplicating', async () => {
      prisma.client.findFirst.mockResolvedValue(client);

      await expect(
        service.findOrCreate('biz-1', {
          name: 'Someone',
          phone: '+549111111',
        }),
      ).resolves.toEqual(client);

      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it('creates when no email/phone match exists', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      const created = {
        ...client,
        id: 'client-2',
        name: 'Bob',
        email: 'bob@example.com',
        phone: null,
      };
      prisma.client.create.mockResolvedValue(created);

      await expect(
        service.findOrCreate('biz-1', {
          name: 'Bob',
          email: 'bob@example.com',
        }),
      ).resolves.toEqual(created);

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz-1',
          name: 'Bob',
          email: 'bob@example.com',
          phone: undefined,
          notes: undefined,
        },
      });
    });

    it('creates when neither email nor phone provided', async () => {
      const created = {
        ...client,
        id: 'client-3',
        name: 'Walk-in',
        email: null,
        phone: null,
      };
      prisma.client.create.mockResolvedValue(created);

      await expect(
        service.findOrCreate('biz-1', { name: 'Walk-in' }),
      ).resolves.toEqual(created);

      expect(prisma.client.findFirst).not.toHaveBeenCalled();
      expect(prisma.client.create).toHaveBeenCalled();
    });
  });
});
