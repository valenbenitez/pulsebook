import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { zonedDateTimeToUtc } from '../availability/time.util';
import { BusinessService } from '../business/business.service';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreatePublicAppointmentDto } from './dto/create-public-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments.query.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { addMinutes, rangesOverlapWithBuffer } from './overlap.util';

const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessService: BusinessService,
    private readonly clientsService: ClientsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async create(ownerId: string, dto: CreateAppointmentDto) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, businessId: business.id },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId: business.id, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, service.durationMin);
    const status = dto.status ?? AppointmentStatus.PENDING;

    await this.assertWithinWorkingHours(
      business.id,
      business.timezone,
      startsAt,
      endsAt,
    );

    if (BLOCKING_STATUSES.includes(status)) {
      await this.assertNoOverlap(
        business.id,
        business.bufferMin,
        startsAt,
        endsAt,
      );
    }

    return this.prisma.appointment.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        serviceId: service.id,
        startsAt,
        endsAt,
        status,
        notes: dto.notes,
      },
    });
  }

  async findAll(ownerId: string, query: ListAppointmentsQueryDto) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const where: Prisma.AppointmentWhereInput = {
      businessId: business.id,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      where.startsAt = {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lt: new Date(query.to) }),
      };
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(ownerId: string, id: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, businessId: business.id },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  async update(ownerId: string, id: string, dto: UpdateAppointmentDto) {
    const existing = await this.findOne(ownerId, id);
    const business = await this.businessService.getByOwnerId(ownerId);

    const status = dto.status ?? existing.status;
    let startsAt = existing.startsAt;
    let endsAt = existing.endsAt;

    if (dto.startsAt !== undefined) {
      const service = await this.prisma.service.findFirst({
        where: { id: existing.serviceId, businessId: business.id },
      });
      if (!service) {
        throw new NotFoundException('Service not found');
      }
      startsAt = new Date(dto.startsAt);
      endsAt = addMinutes(startsAt, service.durationMin);
    }

    const becomingBlocking =
      BLOCKING_STATUSES.includes(status) &&
      !BLOCKING_STATUSES.includes(existing.status);
    const rescheduled = dto.startsAt !== undefined;
    // Revalidate when time changes or when moving back into a blocking status.
    // CANCELLED/COMPLETED/NO_SHOW stop blocking the slot (no overlap check).
    if (BLOCKING_STATUSES.includes(status) && (rescheduled || becomingBlocking)) {
      await this.assertWithinWorkingHours(
        business.id,
        business.timezone,
        startsAt,
        endsAt,
      );
      await this.assertNoOverlap(
        business.id,
        business.bufferMin,
        startsAt,
        endsAt,
        existing.id,
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.startsAt !== undefined && { startsAt, endsAt }),
      },
    });
  }

  async createPublic(slug: string, dto: CreatePublicAppointmentDto) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId: business.id, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, service.durationMin);

    await this.assertWithinWorkingHours(
      business.id,
      business.timezone,
      startsAt,
      endsAt,
    );
    await this.assertNoOverlap(
      business.id,
      business.bufferMin,
      startsAt,
      endsAt,
    );

    const client = await this.clientsService.findOrCreate(business.id, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      notes: dto.notes,
    });

    return this.prisma.appointment.create({
      data: {
        businessId: business.id,
        clientId: client.id,
        serviceId: service.id,
        startsAt,
        endsAt,
        status: AppointmentStatus.PENDING,
        notes: dto.notes,
      },
    });
  }

  /**
   * Ensure [startsAt, endsAt] lies fully inside an open WorkingHours / exception
   * window for the calendar day of startsAt in the business timezone.
   * Reuses AvailabilityService.resolveWindowsForDate (same rule as public slots).
   */
  async assertWithinWorkingHours(
    businessId: string,
    timeZone: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    if (!(startsAt.getTime() < endsAt.getTime())) {
      throw new BadRequestException('startsAt must be before endsAt');
    }

    const dateYmd = this.dateYmdInTimeZone(startsAt, timeZone);
    const endDateYmd = this.dateYmdInTimeZone(
      new Date(endsAt.getTime() - 1),
      timeZone,
    );
    if (dateYmd !== endDateYmd) {
      throw new BadRequestException(
        'Appointment must stay within a single calendar day in the business timezone',
      );
    }

    const windows = await this.availabilityService.resolveWindowsForDate(
      businessId,
      timeZone,
      dateYmd,
    );
    if (windows.length === 0) {
      throw new BadRequestException(
        'No working hours for this date (closed or no schedule)',
      );
    }

    const fits = windows.some((w) => {
      const windowStart = zonedDateTimeToUtc(dateYmd, w.startTime, timeZone);
      const windowEnd = zonedDateTimeToUtc(dateYmd, w.endTime, timeZone);
      return (
        startsAt.getTime() >= windowStart.getTime() &&
        endsAt.getTime() <= windowEnd.getTime()
      );
    });

    if (!fits) {
      throw new BadRequestException(
        'Appointment is outside working hours for this date',
      );
    }
  }

  async assertNoOverlap(
    businessId: string,
    bufferMin: number,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ): Promise<void> {
    const bufferMs = Math.max(0, bufferMin) * 60_000;
    // Prefetch neighbors: existing.start < candidate.end AND
    // existing.end > candidate.start - buffer (buffer only after existing end).
    const candidates = await this.prisma.appointment.findMany({
      where: {
        businessId,
        status: { in: BLOCKING_STATUSES },
        ...(excludeId && { id: { not: excludeId } }),
        startsAt: { lt: endsAt },
        endsAt: { gt: new Date(startsAt.getTime() - bufferMs) },
      },
      select: { id: true, startsAt: true, endsAt: true },
    });

    const conflict = candidates.find((c) =>
      rangesOverlapWithBuffer(
        startsAt,
        endsAt,
        c.startsAt,
        c.endsAt,
        bufferMin,
      ),
    );

    if (conflict) {
      throw new ConflictException('Time slot overlaps an existing appointment');
    }
  }

  /** YYYY-MM-DD for an instant in the given IANA timezone. */
  dateYmdInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }
    return `${map.year}-${map.month}-${map.day}`;
  }
}
