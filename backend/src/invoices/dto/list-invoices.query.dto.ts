import { InvoiceStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
