import { Prisma } from '@prisma/client';

export type ClientResponse = Prisma.ClientGetPayload<Record<string, never>>;
