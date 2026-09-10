/** Line item shape used to compute invoice totals in USD. */
export type InvoiceLineInput = {
  quantity: number;
  unitPrice: number;
};

/**
 * Sum of quantity * unitPrice, rounded to 2 decimal places (USD cents).
 */
export function computeInvoiceTotal(items: InvoiceLineInput[]): number {
  const raw = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  return Math.round(raw * 100) / 100;
}
