import { Prisma } from '@prisma/client';
import {
  toServiceResponse,
  type ServiceResponse,
} from './service.response';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

describe('ServiceResponse', () => {
  it('matches Prisma Service scalars with price as string (wire), not Decimal', () => {
    type Expected = Omit<
      Prisma.ServiceGetPayload<Record<string, never>>,
      'price'
    > & { price: string };
    const equal: AssertEqual<ServiceResponse, Expected> = true;
    expect(equal).toBe(true);

    type PriceIsString = ServiceResponse['price'] extends string
      ? true
      : false;
    const priceIsString: PriceIsString = true;
    expect(priceIsString).toBe(true);

    type PriceIsNotDecimal = ServiceResponse['price'] extends Prisma.Decimal
      ? false
      : true;
    const priceIsNotDecimal: PriceIsNotDecimal = true;
    expect(priceIsNotDecimal).toBe(true);

    const sample: ServiceResponse = {
      id: 'svc-1',
      businessId: 'biz-1',
      name: 'Cut',
      description: null,
      durationMin: 30,
      price: '25',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    expect(sample.price).toBe('25');
    expect(typeof sample.price).toBe('string');
    expect(Object.keys(sample).sort()).toEqual(
      [
        'id',
        'businessId',
        'name',
        'description',
        'durationMin',
        'price',
        'isActive',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });
});

describe('toServiceResponse', () => {
  it('maps Prisma Decimal price to string via toString()', () => {
    const record = {
      id: 'svc-1',
      businessId: 'biz-1',
      name: 'Cut',
      description: 'Classic',
      durationMin: 45,
      price: new Prisma.Decimal('30.50'),
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    const result = toServiceResponse(record);

    expect(result.price).toBe('30.5');
    expect(typeof result.price).toBe('string');
    expect(result).toEqual({
      ...record,
      price: '30.5',
    });
  });
});
