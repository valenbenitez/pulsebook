import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ProfessionType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    $transaction: jest.Mock;
    user: { findUnique: jest.Mock; create: jest.Mock };
    business: { create: jest.Mock };
  };

  const registerDto = {
    email: 'pro@example.com',
    password: 'password123',
    name: 'Pro',
    businessName: 'Pro Shop',
    slug: 'pro-shop',
    timezone: 'America/Argentina/Buenos_Aires',
    professionType: ProfessionType.BARBER,
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      user: { findUnique: jest.fn(), create: jest.fn() },
      business: { create: jest.fn() },
    };
    service = new AuthService(prisma as unknown as PrismaService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('creates User + Business in a transaction and hashes password', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const user = {
        id: 'user-1',
        email: 'pro@example.com',
        name: 'Pro',
        passwordHash: 'hashed',
      };
      const business = {
        id: 'biz-1',
        ownerId: 'user-1',
        name: 'Pro Shop',
        slug: 'pro-shop',
        timezone: registerDto.timezone,
        professionType: ProfessionType.BARBER,
        bufferMin: 15,
      };

      prisma.$transaction.mockImplementation(async (fn) =>
        fn({
          user: {
            create: jest.fn().mockResolvedValue(user),
          },
          business: {
            create: jest.fn().mockResolvedValue(business),
          },
        }),
      );

      const result = await service.register(registerDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'pro@example.com',
        name: 'Pro',
      });
      expect(result.business.bufferMin).toBe(15);
      expect(result.business.slug).toBe('pro-shop');
    });

    it('throws ConflictException on duplicate email/slug (P2002)', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(service.register(registerDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('validateCredentials', () => {
    it('returns user when password matches', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'pro@example.com',
        name: 'Pro',
        passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateCredentials({
          email: 'pro@example.com',
          password: 'password123',
        }),
      ).resolves.toEqual({
        id: 'user-1',
        email: 'pro@example.com',
        name: 'Pro',
      });
    });

    it('rejects incorrect password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'pro@example.com',
        name: 'Pro',
        passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateCredentials({
          email: 'pro@example.com',
          password: 'wrong',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateCredentials({
          email: 'missing@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
