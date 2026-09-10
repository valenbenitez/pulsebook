import { PaymentMethod } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class PayInvoiceDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}
