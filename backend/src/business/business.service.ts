import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async getByOwnerId(ownerId: string) {
    const business = await this.prisma.business.findUnique({
      where: { ownerId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }

  async updateByOwnerId(ownerId: string, dto: UpdateBusinessDto) {
    await this.getByOwnerId(ownerId);

    try {
      return await this.prisma.business.update({
        where: { ownerId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.timezone !== undefined && { timezone: dto.timezone }),
          ...(dto.professionType !== undefined && {
            professionType: dto.professionType,
          }),
          ...(dto.bufferMin !== undefined && { bufferMin: dto.bufferMin }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Slug already in use');
      }
      throw error;
    }
  }
}
