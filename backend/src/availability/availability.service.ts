import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { BusinessService } from '../business/business.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { CreateWorkingHoursDto } from './dto/create-working-hours.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-availability-exception.dto';
import { UpdateWorkingHoursDto } from './dto/update-working-hours.dto';
import {
  addCalendarDays,
  computeFreeSlots,
  dayOfWeekInTimeZone,
  isStartBeforeEnd,
  isValidHhMm,
  TimeWindow,
  zonedDateTimeToUtc,
} from './time.util';

const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessService: BusinessService,
  ) {}

  // ─── Working hours ─────────────────────────────────────────────────────────

  async createWorkingHours(ownerId: string, dto: CreateWorkingHoursDto) {
    const business = await this.businessService.getByOwnerId(ownerId);
    return this.prisma.workingHours.create({
      data: {
        businessId: business.id,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
  }

  async listWorkingHours(ownerId: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    return this.prisma.workingHours.findMany({
      where: { businessId: business.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getWorkingHoursById(ownerId: string, id: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const row = await this.prisma.workingHours.findFirst({
      where: { id, businessId: business.id },
    });
    if (!row) {
      throw new NotFoundException('Working hours not found');
    }
    return row;
  }

  async updateWorkingHours(
    ownerId: string,
    id: string,
    dto: UpdateWorkingHoursDto,
  ) {
    const existing = await this.getWorkingHoursById(ownerId, id);
    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;
    if (!isValidHhMm(startTime) || !isValidHhMm(endTime)) {
      throw new BadRequestException('startTime/endTime must be HH:mm');
    }
    if (!isStartBeforeEnd(startTime, endTime)) {
      throw new BadRequestException('startTime must be before endTime');
    }

    return this.prisma.workingHours.update({
      where: { id },
      data: {
        ...(dto.dayOfWeek !== undefined && { dayOfWeek: dto.dayOfWeek }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime }),
      },
    });
  }

  async deleteWorkingHours(ownerId: string, id: string) {
    await this.getWorkingHoursById(ownerId, id);
    await this.prisma.workingHours.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Exceptions ────────────────────────────────────────────────────────────

  async createException(ownerId: string, dto: CreateAvailabilityExceptionDto) {
    const business = await this.businessService.getByOwnerId(ownerId);
    this.assertExceptionWindow(dto.isClosed, dto.startTime, dto.endTime);

    try {
      return await this.prisma.availabilityException.create({
        data: {
          businessId: business.id,
          date: this.toDateOnly(dto.date),
          isClosed: dto.isClosed,
          startTime: dto.isClosed ? null : (dto.startTime ?? null),
          endTime: dto.isClosed ? null : (dto.endTime ?? null),
          reason: dto.reason,
        },
      });
    } catch (error) {
      this.rethrowUniqueDate(error);
    }
  }

  async listExceptions(ownerId: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    return this.prisma.availabilityException.findMany({
      where: { businessId: business.id },
      orderBy: { date: 'asc' },
    });
  }

  async getExceptionById(ownerId: string, id: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const row = await this.prisma.availabilityException.findFirst({
      where: { id, businessId: business.id },
    });
    if (!row) {
      throw new NotFoundException('Availability exception not found');
    }
    return row;
  }

  async updateException(
    ownerId: string,
    id: string,
    dto: UpdateAvailabilityExceptionDto,
  ) {
    const existing = await this.getExceptionById(ownerId, id);
    const isClosed = dto.isClosed ?? existing.isClosed;
    const startTime =
      dto.isClosed === true
        ? null
        : dto.startTime !== undefined
          ? dto.startTime
          : existing.startTime;
    const endTime =
      dto.isClosed === true
        ? null
        : dto.endTime !== undefined
          ? dto.endTime
          : existing.endTime;

    this.assertExceptionWindow(
      isClosed,
      startTime ?? undefined,
      endTime ?? undefined,
    );

    const data: Prisma.AvailabilityExceptionUpdateInput = {
      ...(dto.date !== undefined && { date: this.toDateOnly(dto.date) }),
      ...(dto.isClosed !== undefined && { isClosed: dto.isClosed }),
      ...(dto.reason !== undefined && { reason: dto.reason }),
    };

    if (isClosed) {
      data.startTime = null;
      data.endTime = null;
    } else {
      data.startTime = startTime;
      data.endTime = endTime;
    }

    try {
      return await this.prisma.availabilityException.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.rethrowUniqueDate(error);
    }
  }

  async deleteException(ownerId: string, id: string) {
    await this.getExceptionById(ownerId, id);
    await this.prisma.availabilityException.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Public slots ──────────────────────────────────────────────────────────

  async getPublicSlots(slug: string, serviceId: string, dateYmd: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId: business.id, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const windows = await this.resolveWindowsForDate(
      business.id,
      business.timezone,
      dateYmd,
    );

    if (windows.length === 0) {
      return {
        date: dateYmd,
        timezone: business.timezone,
        serviceId: service.id,
        durationMin: service.durationMin,
        bufferMin: business.bufferMin,
        slots: [],
      };
    }

    const dayStart = zonedDateTimeToUtc(dateYmd, '00:00', business.timezone);
    const dayEnd = zonedDateTimeToUtc(
      addCalendarDays(dateYmd, 1),
      '00:00',
      business.timezone,
    );

    const appointments = await this.prisma.appointment.findMany({
      where: {
        businessId: business.id,
        status: { in: BLOCKING_STATUSES },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots = computeFreeSlots({
      windows,
      dateYmd,
      timeZone: business.timezone,
      durationMin: service.durationMin,
      bufferMin: business.bufferMin,
      busy: appointments,
    });

    return {
      date: dateYmd,
      timezone: business.timezone,
      serviceId: service.id,
      durationMin: service.durationMin,
      bufferMin: business.bufferMin,
      slots: slots.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
    };
  }

  /**
   * Resolve open windows for a calendar date: exception overrides WorkingHours.
   * Closed exception → empty. Open exception → special window. Else weekly hours.
   */
  async resolveWindowsForDate(
    businessId: string,
    timeZone: string,
    dateYmd: string,
  ): Promise<TimeWindow[]> {
    const exception = await this.prisma.availabilityException.findUnique({
      where: {
        businessId_date: {
          businessId,
          date: this.toDateOnly(dateYmd),
        },
      },
    });

    if (exception) {
      if (exception.isClosed) {
        return [];
      }
      if (
        exception.startTime &&
        exception.endTime &&
        isValidHhMm(exception.startTime) &&
        isValidHhMm(exception.endTime) &&
        isStartBeforeEnd(exception.startTime, exception.endTime)
      ) {
        return [
          { startTime: exception.startTime, endTime: exception.endTime },
        ];
      }
      return [];
    }

    const dayOfWeek = dayOfWeekInTimeZone(dateYmd, timeZone);
    const hours = await this.prisma.workingHours.findMany({
      where: { businessId, dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    return hours.map((h) => ({
      startTime: h.startTime,
      endTime: h.endTime,
    }));
  }

  private toDateOnly(dateYmd: string): Date {
    return new Date(`${dateYmd}T00:00:00.000Z`);
  }

  private assertExceptionWindow(
    isClosed: boolean,
    startTime?: string | null,
    endTime?: string | null,
  ) {
    if (isClosed) {
      return;
    }
    if (!startTime || !endTime) {
      throw new BadRequestException(
        'startTime and endTime are required when isClosed is false',
      );
    }
    if (!isValidHhMm(startTime) || !isValidHhMm(endTime)) {
      throw new BadRequestException('startTime/endTime must be HH:mm');
    }
    if (!isStartBeforeEnd(startTime, endTime)) {
      throw new BadRequestException('startTime must be before endTime');
    }
  }

  private rethrowUniqueDate(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'An exception already exists for this business and date',
      );
    }
    throw error;
  }
}
