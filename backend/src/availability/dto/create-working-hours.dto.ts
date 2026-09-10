import { IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { IsStartBeforeEnd } from '../validators/is-start-before-end.validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateWorkingHoursDto {
  /** 0 = Sunday … 6 = Saturday */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(HH_MM, { message: 'startTime must be HH:mm' })
  @IsStartBeforeEnd('endTime', {
    message: 'startTime must be before endTime',
  })
  startTime!: string;

  @IsString()
  @Matches(HH_MM, { message: 'endTime must be HH:mm' })
  endTime!: string;
}
