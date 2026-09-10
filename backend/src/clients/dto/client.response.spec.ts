import { Prisma } from '@prisma/client';
import type { ClientResponse } from './client.response';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

describe('ClientResponse', () => {
  it('matches Prisma Client scalar payload without relations', () => {
    type Expected = Prisma.ClientGetPayload<Record<string, never>>;
    const equal: AssertEqual<ClientResponse, Expected> = true;
    expect(equal).toBe(true);

    const sample: ClientResponse = {
      id: 'client-1',
      businessId: 'biz-1',
      name: 'Ana',
      email: 'ana@example.com',
      phone: '+549111111',
      notes: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    expect(sample).toEqual(
      expect.objectContaining({
        id: 'client-1',
        businessId: 'biz-1',
        name: 'Ana',
        email: 'ana@example.com',
        phone: '+549111111',
        notes: null,
      }),
    );
    expect(Object.keys(sample).sort()).toEqual(
      [
        'id',
        'businessId',
        'name',
        'email',
        'phone',
        'notes',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });
});
