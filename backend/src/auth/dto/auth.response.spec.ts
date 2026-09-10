import { Prisma } from '@prisma/client';
import type {
  AuthUserPublic,
  RegisterResponse,
  ValidateCredentialsResponse,
} from './auth.response';

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;

type HasPasswordHash<T> = 'passwordHash' extends keyof T ? true : false;

describe('auth response types', () => {
  it('AuthUserPublic is Pick of User scalars (id, email, name) without passwordHash', () => {
    type Expected = Pick<
      Prisma.UserGetPayload<Record<string, never>>,
      'id' | 'email' | 'name'
    >;
    const equal: AssertEqual<AuthUserPublic, Expected> = true;
    expect(equal).toBe(true);

    const noHash: AssertEqual<HasPasswordHash<AuthUserPublic>, false> = true;
    expect(noHash).toBe(true);

    const sample: AuthUserPublic = {
      id: 'user-1',
      email: 'pro@example.com',
      name: 'Pro',
    };
    expect(Object.keys(sample).sort()).toEqual(['email', 'id', 'name'].sort());
    expect(sample).not.toHaveProperty('passwordHash');
  });

  it('RegisterResponse matches { user: AuthUserPublic, business: Business scalars }', () => {
    type Expected = {
      user: AuthUserPublic;
      business: Prisma.BusinessGetPayload<Record<string, never>>;
    };
    const equal: AssertEqual<RegisterResponse, Expected> = true;
    expect(equal).toBe(true);

    const noHashOnUser: AssertEqual<
      HasPasswordHash<RegisterResponse['user']>,
      false
    > = true;
    expect(noHashOnUser).toBe(true);
  });

  it('ValidateCredentialsResponse equals AuthUserPublic (no passwordHash)', () => {
    const equal: AssertEqual<
      ValidateCredentialsResponse,
      AuthUserPublic
    > = true;
    expect(equal).toBe(true);

    const noHash: AssertEqual<
      HasPasswordHash<ValidateCredentialsResponse>,
      false
    > = true;
    expect(noHash).toBe(true);
  });
});
