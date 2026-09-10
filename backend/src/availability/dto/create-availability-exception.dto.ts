import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsStartBeforeEnd } from '../validators/is-start-before-end.validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAvailabilityExceptionDto {
  /** Calendar date in business timezone as YYYY-MM-DD */
  @IsString()
  @Matches(DATE_YMD, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsBoolean()
  isClosed!: boolean;

  @ValidateIf((o: CreateAvailabilityExceptionDto) => o.isClosed === false)
  @IsString()
  @Matches(HH_MM, { message: 'startTime must be HH:mm' })
  @IsStartBeforeEnd('endTime', {
    message: 'startTime must be before endTime',
  })
  startTime?: string;

  @ValidateIf((o: CreateAvailabilityExceptionDto) => o.isClosed === false)
  @IsString()
  @Matches(HH_MM, { message: 'endTime must be HH:mm' })
  endTime?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
