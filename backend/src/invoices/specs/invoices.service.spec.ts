import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, PaymentMethod, Prisma } from '@prisma/client';
import { BusinessService } from '../../business/business.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: {
    invoice: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    invoiceItem: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    client: { findFirst: jest.Mock };
    appointment: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let businessService: { getByOwnerId: jest.Mock };

  const business = {
    id: 'biz-1',
    ownerId: 'user-1',
    name: 'Pro Shop',
    slug: 'pro-shop',
  };

  const draftInvoice = {
    id: 'inv-1',
    businessId: 'biz-1',
    clientId: 'client-1',
    appointmentId: null as string | null,
    number: null as number | null,
    status: InvoiceStatus.DRAFT,
    total: new Prisma.Decimal(25.5),
    paidAt: null as Date | null,
    paymentMethod: null as PaymentMethod | null,
    items: [
      {
        id: 'item-1',
        invoiceId: 'inv-1',
        description: 'Cut',
        quantity: 1,
        unitPrice: new Prisma.Decimal(25.5),
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      invoiceItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      client: { findFirst: jest.fn() },
      appointment: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    businessService = {
      getByOwnerId: jest.fn().mockResolvedValue(business),
    };
    service = new InvoicesService(
      prisma as unknown as PrismaService,
      businessService as unknown as BusinessService,
    );
  });

  describe('create', () => {
    it('creates DRAFT invoice with computed total and items', async () => {
      prisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      prisma.invoice.create.mockResolvedValue(draftInvoice);

      await expect(
        service.create('user-1', {
          clientId: 'client-1',
          items: [
            { description: 'Cut', quantity: 1, unitPrice: 20 },
            { description: 'Product', quantity: 1, unitPrice: 5.5 },
          ],
        }),
      ).resolves.toEqual(draftInvoice);

      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz-1',
          clientId: 'client-1',
          appointmentId: undefined,
          status: InvoiceStatus.DRAFT,
          total: new Prisma.Decimal(25.5),
          items: {
            create: [
              {
                description: 'Cut',
                quantity: 1,
                unitPrice: new Prisma.Decimal(20),
              },
              {
                description: 'Product',
                quantity: 1,
                unitPrice: new Prisma.Decimal(5.5),
              },
            ],
          },
        },
        include: { items: true },
      });
    });

    it('rejects unknown client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      await expect(
        service.create('user-1', {
          clientId: 'missing',
          items: [{ description: 'X', quantity: 1, unitPrice: 1 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it('rejects appointment that already has an invoice', async () => {
      prisma.appointment.findFirst.mockResolvedValue({
        id: 'appt-1',
        invoice: { id: 'inv-other' },
      });
      await expect(
        service.create('user-1', {
          appointmentId: 'appt-1',
          items: [{ description: 'X', quantity: 1, unitPrice: 1 }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll / findOne', () => {
    it('lists invoices filtered by status for the business', async () => {
      prisma.invoice.findMany.mockResolvedValue([draftInvoice]);
      await expect(
        service.findAll('user-1', { status: InvoiceStatus.DRAFT }),
      ).resolves.toEqual([draftInvoice]);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz-1', status: InvoiceStatus.DRAFT },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('throws NotFound for missing or cross-tenant invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne('user-1', 'other'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates items and total only when DRAFT', async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      const updated = {
        ...draftInvoice,
        total: new Prisma.Decimal(40),
        items: [
          {
            id: 'item-2',
            invoiceId: 'inv-1',
            description: 'New',
            quantity: 2,
            unitPrice: new Prisma.Decimal(20),
          },
        ],
      };
      prisma.$transaction.mockImplementation(async (fn) =>
        fn({
          invoiceItem: prisma.invoiceItem,
          invoice: prisma.invoice,
        }),
      );
      prisma.invoiceItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.invoiceItem.createMany.mockResolvedValue({ count: 1 });
      prisma.invoice.update.mockResolvedValue(updated);

      await expect(
        service.update('user-1', 'inv-1', {
          items: [{ description: 'New', quantity: 2, unitPrice: 20 }],
        }),
      ).resolves.toEqual(updated);

      expect(prisma.invoiceItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 'inv-1' },
      });
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { total: new Prisma.Decimal(40) },
        include: { items: true },
      });
    });

    it('rejects update when not DRAFT', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...draftInvoice,
        status: InvoiceStatus.PAID,
      });
      await expect(
        service.update('user-1', 'inv-1', {
          items: [{ description: 'X', quantity: 1, unitPrice: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('issue', () => {
    function mockIssueTransaction() {
      prisma.$transaction.mockImplementation(async (fn) =>
        fn({
          invoice: {
            findFirst: prisma.invoice.findFirst,
            update: prisma.invoice.update,
          },
        }),
      );
    }

    it('assigns next sequential number per business and moves to ISSUED', async () => {
      const issued = {
        ...draftInvoice,
        status: InvoiceStatus.ISSUED,
        number: 4,
      };
      prisma.invoice.findFirst
        .mockResolvedValueOnce(draftInvoice)
        .mockResolvedValueOnce({ number: 3 });
      mockIssueTransaction();
      prisma.invoice.update.mockResolvedValue(issued);

      await expect(service.issue('user-1', 'inv-1')).resolves.toEqual(issued);
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: InvoiceStatus.ISSUED, number: 4 },
        include: { items: true },
      });
    });

    it('starts at 1 when no prior numbered invoices', async () => {
      prisma.invoice.findFirst
        .mockResolvedValueOnce(draftInvoice)
        .mockResolvedValueOnce(null);
      mockIssueTransaction();
      prisma.invoice.update.mockResolvedValue({
        ...draftInvoice,
        status: InvoiceStatus.ISSUED,
        number: 1,
      });

      await service.issue('user-1', 'inv-1');
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: InvoiceStatus.ISSUED, number: 1 },
        }),
      );
    });

    it('rejects issue when not DRAFT', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...draftInvoice,
        status: InvoiceStatus.ISSUED,
        number: 1,
      });
      await expect(service.issue('user-1', 'inv-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('pay', () => {
    it('moves ISSUED to PAID with paidAt and paymentMethod', async () => {
      const issued = {
        ...draftInvoice,
        status: InvoiceStatus.ISSUED,
        number: 1,
      };
      prisma.invoice.findFirst.mockResolvedValue(issued);
      const paid = {
        ...issued,
        status: InvoiceStatus.PAID,
        paidAt: new Date('2026-09-10T12:00:00.000Z'),
        paymentMethod: PaymentMethod.CASH,
      };
      prisma.invoice.update.mockResolvedValue(paid);

      await expect(
        service.pay('user-1', 'inv-1', PaymentMethod.CASH),
      ).resolves.toEqual(paid);

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: expect.any(Date),
          paymentMethod: PaymentMethod.CASH,
        },
        include: { items: true },
      });
    });

    it('rejects pay when not ISSUED', async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      await expect(
        service.pay('user-1', 'inv-1', PaymentMethod.TRANSFER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels DRAFT without deleting', async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      const cancelled = {
        ...draftInvoice,
        status: InvoiceStatus.CANCELLED,
      };
      prisma.invoice.update.mockResolvedValue(cancelled);

      await expect(service.cancel('user-1', 'inv-1')).resolves.toEqual(
        cancelled,
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: InvoiceStatus.CANCELLED },
        include: { items: true },
      });
    });

    it('rejects cancel when PAID', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...draftInvoice,
        status: InvoiceStatus.PAID,
      });
      await expect(service.cancel('user-1', 'inv-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
