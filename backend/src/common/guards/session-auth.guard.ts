import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AuthUser } from '../types/auth-user';

/**
 * Validates Auth.js-compatible session JWTs shared with Next.
 *
 * Contract for Next (Auth.js Credentials + JWT session):
 * - After authorize() calls Nest `POST /api/auth/validate`, put `user.id` in JWT `sub`
 *   and `user.email` in `email` (Auth.js jwt/session callbacks).
 * - Forward the session JWT to Nest as `Authorization: Bearer <token>`.
 * - Sign with the same `AUTH_SECRET` used here (HS256 JWT for Nest MVP).
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing session');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing session');
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Auth is not configured');
    }

    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;

      const id = typeof payload.sub === 'string' ? payload.sub : null;
      const email = typeof payload.email === 'string' ? payload.email : null;
      if (!id || !email) {
        throw new UnauthorizedException('Invalid session');
      }
      request.user = { id, email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid session');
    }
  }
}
