import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import {
  toServiceResponse,
  type ServiceResponse,
} from './dto/service.response';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBusinessIdForOwner(ownerId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business.id;
  }

  async create(ownerId: string, dto: CreateServiceDto): Promise<ServiceResponse> {
    const businessId = await this.getBusinessIdForOwner(ownerId);
    const created = await this.prisma.service.create({
      data: {
        businessId,
        name: dto.name,
        description: dto.description,
        durationMin: dto.durationMin,
        price: new Prisma.Decimal(dto.price),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return toServiceResponse(created);
  }

  async list(ownerId: string, isActive?: boolean): Promise<ServiceResponse[]> {
    const businessId = await this.getBusinessIdForOwner(ownerId);
    const services = await this.prisma.service.findMany({
      where: {
        businessId,
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: { createdAt: 'asc' },
    });
    return services.map(toServiceResponse);
  }

  async getById(ownerId: string, id: string): Promise<ServiceResponse> {
    const businessId = await this.getBusinessIdForOwner(ownerId);
    const service = await this.prisma.service.findFirst({
      where: { id, businessId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return toServiceResponse(service);
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceResponse> {
    await this.getById(ownerId, id);

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.durationMin !== undefined && { durationMin: dto.durationMin }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return toServiceResponse(updated);
  }
}
