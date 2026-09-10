import { computeInvoiceTotal } from '../invoice-total.util';

describe('computeInvoiceTotal', () => {
  it('sums quantity * unitPrice', () => {
    expect(
      computeInvoiceTotal([
        { quantity: 2, unitPrice: 10 },
        { quantity: 1, unitPrice: 5.5 },
      ]),
    ).toBe(25.5);
  });

  it('rounds to 2 decimal places (USD cents)', () => {
    expect(
      computeInvoiceTotal([{ quantity: 3, unitPrice: 0.1 }]),
    ).toBe(0.3);
  });

  it('returns 0 for empty items', () => {
    expect(computeInvoiceTotal([])).toBe(0);
  });
});
