import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SessionAuthGuard } from './session-auth.guard';

describe('SessionAuthGuard', () => {
  const secret = 'test-secret';
  let guard: SessionAuthGuard;
  let originalSecret: string | undefined;

  beforeEach(() => {
    guard = new SessionAuthGuard();
    originalSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = secret;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalSecret;
    }
  });

  function mockContext(authorization?: string) {
    const request: {
      headers: { authorization?: string };
      user?: { id: string; email: string };
    } = {
      headers: { authorization },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
  }

  it('accepts a valid Bearer JWT and attaches user', () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'pro@example.com' },
      secret,
      { algorithm: 'HS256' },
    );

    const ctx = mockContext(`Bearer ${token}`);
    expect(guard.canActivate(ctx as unknown as ExecutionContext)).toBe(true);
    expect(ctx.request.user).toEqual({
      id: 'user-1',
      email: 'pro@example.com',
    });
  });

  it('rejects missing Authorization header with 401', () => {
    const ctx = mockContext();
    expect(() =>
      guard.canActivate(ctx as unknown as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });

  it('rejects invalid token with 401', () => {
    const ctx = mockContext('Bearer not-a-jwt');
    expect(() =>
      guard.canActivate(ctx as unknown as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });
});
