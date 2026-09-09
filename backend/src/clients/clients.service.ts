import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BusinessService } from '../business/business.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

export type FindOrCreateClientInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessService: BusinessService,
  ) {}

  async create(ownerId: string, dto: CreateClientDto) {
    const business = await this.businessService.getByOwnerId(ownerId);
    return this.prisma.client.create({
      data: {
        businessId: business.id,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
      },
    });
  }

  async findAll(ownerId: string, search?: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const where: Prisma.ClientWhereInput = {
      businessId: business.id,
    };

    const q = search?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ownerId: string, id: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const client = await this.prisma.client.findFirst({
      where: { id, businessId: business.id },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async update(ownerId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(ownerId, id);
    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  /**
   * Match by email or phone within the business; create if no match.
   * Used by appointments for implicit client upsert on public booking.
   */
  async findOrCreate(businessId: string, input: FindOrCreateClientInput) {
    const email = input.email?.trim() || null;
    const phone = input.phone?.trim() || null;

    const or: Prisma.ClientWhereInput[] = [];
    if (email) {
      or.push({ email: { equals: email, mode: 'insensitive' } });
    }
    if (phone) {
      or.push({ phone });
    }

    if (or.length > 0) {
      const existing = await this.prisma.client.findFirst({
        where: { businessId, OR: or },
      });
      if (existing) {
        return existing;
      }
    }

    return this.prisma.client.create({
      data: {
        businessId,
        name: input.name,
        email: email ?? undefined,
        phone: phone ?? undefined,
        notes: input.notes ?? undefined,
      },
    });
  }
}
