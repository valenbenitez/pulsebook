import { Prisma } from '@prisma/client';

export type BusinessResponse = Prisma.BusinessGetPayload<Record<string, never>>;
