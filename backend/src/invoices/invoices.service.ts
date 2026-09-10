import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { BusinessService } from '../business/business.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceItemDto } from './dto/invoice-item.dto';
import {
  toInvoiceResponse,
  type InvoiceListResponse,
  type InvoiceResponse,
} from './dto/invoice.response';
import { ListInvoicesQueryDto } from './dto/list-invoices.query.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { computeInvoiceTotal } from './invoice-total.util';

const invoiceInclude = {
  items: true,
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessService: BusinessService,
  ) {}

  async create(
    ownerId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceResponse> {
    const business = await this.businessService.getByOwnerId(ownerId);

    if (dto.clientId) {
      await this.assertClientInBusiness(business.id, dto.clientId);
    }
    if (dto.appointmentId) {
      await this.assertAppointmentAvailable(business.id, dto.appointmentId);
    }

    const total = computeInvoiceTotal(dto.items);

    try {
      const created = await this.prisma.invoice.create({
        data: {
          businessId: business.id,
          clientId: dto.clientId,
          appointmentId: dto.appointmentId,
          status: InvoiceStatus.DRAFT,
          total: new Prisma.Decimal(total),
          items: {
            create: dto.items.map((item) => this.toItemCreate(item)),
          },
        },
        include: invoiceInclude,
      });
      return toInvoiceResponse(created);
    } catch (error) {
      this.rethrowUniqueAppointmentConflict(error);
      throw error;
    }
  }

  async findAll(
    ownerId: string,
    query: ListInvoicesQueryDto,
  ): Promise<InvoiceListResponse> {
    const business = await this.businessService.getByOwnerId(ownerId);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId: business.id,
        ...(query.status && { status: query.status }),
      },
      include: invoiceInclude,
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map(toInvoiceResponse);
  }

  async findOne(ownerId: string, id: string): Promise<InvoiceResponse> {
    return this.findOneRecord(ownerId, id).then(toInvoiceResponse);
  }

  async update(
    ownerId: string,
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<InvoiceResponse> {
    const existing = await this.findOneRecord(ownerId, id);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be updated');
    }

    const business = await this.businessService.getByOwnerId(ownerId);

    if (dto.clientId !== undefined && dto.clientId !== null) {
      await this.assertClientInBusiness(business.id, dto.clientId);
    }

    const items = dto.items;
    const total =
      items !== undefined ? computeInvoiceTotal(items) : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (items !== undefined) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceItem.createMany({
          data: items.map((item) => ({
            invoiceId: id,
            ...this.toItemCreate(item),
          })),
        });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.clientId !== undefined && { clientId: dto.clientId }),
          ...(total !== undefined && {
            total: new Prisma.Decimal(total),
          }),
        },
        include: invoiceInclude,
      });
    });
    return toInvoiceResponse(updated);
  }

  async issue(ownerId: string, id: string): Promise<InvoiceResponse> {
    const existing = await this.findOneRecord(ownerId, id);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be issued');
    }

    const business = await this.businessService.getByOwnerId(ownerId);

    const issued = await this.prisma.$transaction(async (tx) => {
      const last = await tx.invoice.findFirst({
        where: {
          businessId: business.id,
          number: { not: null },
        },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      const nextNumber = (last?.number ?? 0) + 1;

      try {
        return await tx.invoice.update({
          where: { id },
          data: {
            status: InvoiceStatus.ISSUED,
            number: nextNumber,
          },
          include: invoiceInclude,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('Invoice number conflict; retry issue');
        }
        throw error;
      }
    });
    return toInvoiceResponse(issued);
  }

  async pay(
    ownerId: string,
    id: string,
    paymentMethod: PaymentMethod,
  ): Promise<InvoiceResponse> {
    const existing = await this.findOneRecord(ownerId, id);
    if (existing.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Only ISSUED invoices can be paid');
    }

    const paid = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        paymentMethod,
      },
      include: invoiceInclude,
    });
    return toInvoiceResponse(paid);
  }

  async cancel(ownerId: string, id: string): Promise<InvoiceResponse> {
    const existing = await this.findOneRecord(ownerId, id);
    if (
      existing.status !== InvoiceStatus.DRAFT &&
      existing.status !== InvoiceStatus.ISSUED
    ) {
      throw new BadRequestException(
        'Only DRAFT or ISSUED invoices can be cancelled',
      );
    }

    const cancelled = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
      include: invoiceInclude,
    });
    return toInvoiceResponse(cancelled);
  }

  private async findOneRecord(ownerId: string, id: string) {
    const business = await this.businessService.getByOwnerId(ownerId);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId: business.id },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  private toItemCreate(item: InvoiceItemDto) {
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: new Prisma.Decimal(item.unitPrice),
    };
  }

  private async assertClientInBusiness(businessId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, businessId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
  }

  private async assertAppointmentAvailable(
    businessId: string,
    appointmentId: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      select: { id: true, invoice: { select: { id: true } } },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    if (appointment.invoice) {
      throw new ConflictException(
        'Appointment already has an invoice (1:1)',
      );
    }
  }

  private rethrowUniqueAppointmentConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [target];
      if (fields.includes('appointmentId')) {
        throw new ConflictException(
          'Appointment already has an invoice (1:1)',
        );
      }
    }
  }
}
