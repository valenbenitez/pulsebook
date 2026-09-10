import { Prisma } from '@prisma/client';

const invoiceWithItems = {
  include: { items: true },
} satisfies Prisma.InvoiceDefaultArgs;

type InvoiceWithItems = Prisma.InvoiceGetPayload<typeof invoiceWithItems>;
type InvoiceItemRecord = InvoiceWithItems['items'][number];

/**
 * Wire contract for Invoice endpoints (CRUD + issue/pay/cancel).
 *
 * Prisma models `total` and item `unitPrice` as `Decimal`. Without an explicit
 * map, Nest/JSON often serializes Decimal as a string, but TypeScript would
 * still say `Decimal` — an implicit, fragile contract for clients.
 *
 * Choice: `string` (not number) to match real JSON and avoid float precision
 * issues — same treatment as Service `price`. Mapped via `.toString()`.
 *
 * Queries use `include: { items: true }` (see `invoiceInclude` in service).
 */
export type InvoiceItemResponse = Omit<InvoiceItemRecord, 'unitPrice'> & {
  unitPrice: string;
};

export type InvoiceResponse = Omit<InvoiceWithItems, 'total' | 'items'> & {
  total: string;
  items: InvoiceItemResponse[];
};

export type InvoiceListResponse = InvoiceResponse[];

export function toInvoiceItemResponse(
  item: InvoiceItemRecord,
): InvoiceItemResponse {
  return {
    ...item,
    unitPrice: item.unitPrice.toString(),
  };
}

export function toInvoiceResponse(invoice: InvoiceWithItems): InvoiceResponse {
  return {
    ...invoice,
    total: invoice.total.toString(),
    items: invoice.items.map(toInvoiceItemResponse),
  };
}
