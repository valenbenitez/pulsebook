import { AppointmentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Reschedule start; endsAt is recomputed from the linked service duration. */
  @IsOptional()
  @IsDateString()
  startsAt?: string;
}
