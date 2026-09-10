import { InvoiceStatus, Prisma } from '@prisma/client';
import {
  toInvoiceItemResponse,
  toInvoiceResponse,
  type InvoiceItemResponse,
  type InvoiceResponse,
} from './invoice.response';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

const invoiceWithItems = {
  include: { items: true },
} satisfies Prisma.InvoiceDefaultArgs;

type InvoiceWithItems = Prisma.InvoiceGetPayload<typeof invoiceWithItems>;
type InvoiceItemRecord = InvoiceWithItems['items'][number];

describe('InvoiceItemResponse', () => {
  it('matches InvoiceItem scalars with unitPrice as string (wire), not Decimal', () => {
    type Expected = Omit<InvoiceItemRecord, 'unitPrice'> & {
      unitPrice: string;
    };
    const equal: AssertEqual<InvoiceItemResponse, Expected> = true;
    expect(equal).toBe(true);

    type UnitPriceIsString = InvoiceItemResponse['unitPrice'] extends string
      ? true
      : false;
    const unitPriceIsString: UnitPriceIsString = true;
    expect(unitPriceIsString).toBe(true);

    type UnitPriceIsNotDecimal =
      InvoiceItemResponse['unitPrice'] extends Prisma.Decimal ? false : true;
    const unitPriceIsNotDecimal: UnitPriceIsNotDecimal = true;
    expect(unitPriceIsNotDecimal).toBe(true);
  });
});

describe('InvoiceResponse', () => {
  it('matches Invoice with items; total and unitPrice as string (wire)', () => {
    type Expected = Omit<InvoiceWithItems, 'total' | 'items'> & {
      total: string;
      items: InvoiceItemResponse[];
    };
    const equal: AssertEqual<InvoiceResponse, Expected> = true;
    expect(equal).toBe(true);

    type TotalIsString = InvoiceResponse['total'] extends string ? true : false;
    const totalIsString: TotalIsString = true;
    expect(totalIsString).toBe(true);

    type TotalIsNotDecimal = InvoiceResponse['total'] extends Prisma.Decimal
      ? false
      : true;
    const totalIsNotDecimal: TotalIsNotDecimal = true;
    expect(totalIsNotDecimal).toBe(true);

    const sample: InvoiceResponse = {
      id: 'inv-1',
      businessId: 'biz-1',
      clientId: 'client-1',
      appointmentId: null,
      number: null,
      status: InvoiceStatus.DRAFT,
      total: '25.5',
      paidAt: null,
      paymentMethod: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      items: [
        {
          id: 'item-1',
          invoiceId: 'inv-1',
          description: 'Cut',
          quantity: 1,
          unitPrice: '25.5',
        },
      ],
    };

    expect(sample.total).toBe('25.5');
    expect(typeof sample.total).toBe('string');
    expect(sample.items[0].unitPrice).toBe('25.5');
    expect(typeof sample.items[0].unitPrice).toBe('string');
  });
});

describe('toInvoiceItemResponse', () => {
  it('maps Prisma Decimal unitPrice to string via toString()', () => {
    const record = {
      id: 'item-1',
      invoiceId: 'inv-1',
      description: 'Cut',
      quantity: 1,
      unitPrice: new Prisma.Decimal('25.50'),
    };

    const result = toInvoiceItemResponse(record);

    expect(result.unitPrice).toBe('25.5');
    expect(typeof result.unitPrice).toBe('string');
    expect(result).toEqual({
      ...record,
      unitPrice: '25.5',
    });
  });
});

describe('toInvoiceResponse', () => {
  it('maps total and nested item unitPrice Decimals to strings', () => {
    const record = {
      id: 'inv-1',
      businessId: 'biz-1',
      clientId: 'client-1',
      appointmentId: null,
      number: null,
      status: InvoiceStatus.DRAFT,
      total: new Prisma.Decimal('25.50'),
      paidAt: null,
      paymentMethod: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      items: [
        {
          id: 'item-1',
          invoiceId: 'inv-1',
          description: 'Cut',
          quantity: 1,
          unitPrice: new Prisma.Decimal('25.50'),
        },
      ],
    };

    const result = toInvoiceResponse(record);

    expect(result.total).toBe('25.5');
    expect(typeof result.total).toBe('string');
    expect(result.items[0].unitPrice).toBe('25.5');
    expect(typeof result.items[0].unitPrice).toBe('string');
    expect(result).toEqual({
      ...record,
      total: '25.5',
      items: [
        {
          ...record.items[0],
          unitPrice: '25.5',
        },
      ],
    });
  });
});
