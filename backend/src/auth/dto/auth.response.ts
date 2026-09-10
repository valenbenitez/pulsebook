import { Prisma } from '@prisma/client';

/** Public user fields returned by auth endpoints — never includes passwordHash. */
export type AuthUserPublic = Pick<
  Prisma.UserGetPayload<Record<string, never>>,
  'id' | 'email' | 'name'
>;

export type RegisterResponse = {
  user: AuthUserPublic;
  business: Prisma.BusinessGetPayload<Record<string, never>>;
};

export type ValidateCredentialsResponse = AuthUserPublic;
