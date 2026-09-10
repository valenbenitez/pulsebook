import { ProfessionType, Prisma } from '@prisma/client';
import type { BusinessResponse } from './business.response';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

describe('BusinessResponse', () => {
  it('matches Prisma Business scalar payload without relations', () => {
    type Expected = Prisma.BusinessGetPayload<Record<string, never>>;
    const equal: AssertEqual<BusinessResponse, Expected> = true;
    expect(equal).toBe(true);

    const sample: BusinessResponse = {
      id: 'biz-1',
      ownerId: 'user-1',
      name: 'Pro Shop',
      slug: 'pro-shop',
      timezone: 'America/Argentina/Buenos_Aires',
      professionType: ProfessionType.BARBER,
      bufferMin: 15,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    expect(sample).toEqual(
      expect.objectContaining({
        id: 'biz-1',
        ownerId: 'user-1',
        name: 'Pro Shop',
        slug: 'pro-shop',
        timezone: 'America/Argentina/Buenos_Aires',
        professionType: ProfessionType.BARBER,
        bufferMin: 15,
      }),
    );
    expect(Object.keys(sample).sort()).toEqual(
      [
        'id',
        'ownerId',
        'name',
        'slug',
        'timezone',
        'professionType',
        'bufferMin',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });
});
