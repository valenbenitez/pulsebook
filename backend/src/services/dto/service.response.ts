import { Prisma } from '@prisma/client';

/**
 * Wire contract for Service endpoints.
 *
 * Prisma models `price` as `Decimal`. Without an explicit map, Nest/JSON often
 * serializes Decimal as a string, but TypeScript would still say `Decimal` —
 * an implicit, fragile contract for clients.
 *
 * Choice: `price: string` (not number) to match real JSON and avoid float
 * precision issues. Mapped via `price.toString()` before return.
 */
export type ServiceResponse = Omit<
  Prisma.ServiceGetPayload<Record<string, never>>,
  'price'
> & {
  price: string;
};

export type ServiceListResponse = ServiceResponse[];

type ServiceRecord = Prisma.ServiceGetPayload<Record<string, never>>;

export function toServiceResponse(service: ServiceRecord): ServiceResponse {
  return {
    ...service,
    price: service.price.toString(),
  };
}
