import { Request, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual, createHash } from 'crypto';
import { config } from '../config';
import { unauthorized } from '../errors';

export interface AuthRequest extends Request {
  wallet: string;
}

export function authMiddleware(req: any, _res: any, next: NextFunction) {
  // Authorization header only
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) return next(unauthorized('Unauthorized: No token provided'));

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string };
    if (!decoded.sub) {
      return next(unauthorized('Unauthorized: Invalid token format'));
    }
    (req as AuthRequest).wallet = decoded.sub;
    return next();
  } catch {
    return next(unauthorized('Unauthorized: Invalid token'));
  }
}

export function adminAuthMiddleware(req: any, _res: any, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const expected = config.adminApiSecret;

  // Normalize lengths by hashing both — timingSafeEqual requires equal-length buffers
  const tokenBuf = createHash('sha256').update(token).digest();
  const expectedBuf = createHash('sha256').update(expected).digest();

  if (!timingSafeEqual(tokenBuf, expectedBuf)) {
    return next(unauthorized('Admin access only'));
  }

  return next();
}
