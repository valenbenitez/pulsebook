import { AppointmentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsString()
  @MinLength(1)
  serviceId!: string;

  /** ISO-8601 instant for the appointment start. */
  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
