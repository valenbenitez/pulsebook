import { AppointmentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class ListAppointmentsQueryDto {
  /** Inclusive lower bound on startsAt (ISO-8601). */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Exclusive upper bound on startsAt (ISO-8601). */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
