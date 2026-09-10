import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterResponse,
  ValidateCredentialsResponse,
} from './dto/auth.response';
import { RegisterDto } from './dto/register.dto';
import { ValidateCredentialsDto } from './dto/validate-credentials.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            passwordHash,
            name: dto.name,
          },
        });

        const business = await tx.business.create({
          data: {
            ownerId: user.id,
            name: dto.businessName,
            slug: dto.slug,
            timezone: dto.timezone,
            professionType: dto.professionType,
          },
        });

        return { user, business };
      });

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        business: result.business,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or slug already in use');
      }
      throw error;
    }
  }

  async validateCredentials(
    dto: ValidateCredentialsDto,
  ): Promise<ValidateCredentialsResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
