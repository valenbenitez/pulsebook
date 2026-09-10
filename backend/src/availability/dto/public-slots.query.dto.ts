import { IsString, Matches, MinLength } from 'class-validator';

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export class PublicSlotsQueryDto {
  @IsString()
  @MinLength(1)
  serviceId!: string;

  /** Calendar date in business timezone as YYYY-MM-DD */
  @IsString()
  @Matches(DATE_YMD, { message: 'date must be YYYY-MM-DD' })
  date!: string;
}
