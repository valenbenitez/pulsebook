import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsStartBeforeEnd } from '../validators/is-start-before-end.validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateWorkingHoursDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  @Matches(HH_MM, { message: 'startTime must be HH:mm' })
  /** Only compares when both startTime and endTime are present in the body. */
  @IsStartBeforeEnd('endTime', {
    message: 'startTime must be before endTime',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(HH_MM, { message: 'endTime must be HH:mm' })
  endTime?: string;
}
