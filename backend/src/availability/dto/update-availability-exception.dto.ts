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

export class UpdateAvailabilityExceptionDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_YMD, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @ValidateIf(
    (o: UpdateAvailabilityExceptionDto) =>
      o.isClosed === false ||
      (o.isClosed === undefined &&
        (o.startTime !== undefined || o.endTime !== undefined)),
  )
  @IsString()
  @Matches(HH_MM, { message: 'startTime must be HH:mm' })
  @ValidateIf(
    (o: UpdateAvailabilityExceptionDto) =>
      o.endTime !== undefined && o.isClosed !== true,
  )
  @IsStartBeforeEnd('endTime', {
    message: 'startTime must be before endTime',
  })
  startTime?: string | null;

  @ValidateIf(
    (o: UpdateAvailabilityExceptionDto) =>
      o.isClosed === false ||
      (o.isClosed === undefined &&
        (o.startTime !== undefined || o.endTime !== undefined)),
  )
  @IsString()
  @Matches(HH_MM, { message: 'endTime must be HH:mm' })
  endTime?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string | null;
}
