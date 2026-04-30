import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { unauthorized } from '../errors';

export interface AuthRequest extends Request {
  wallet: string;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
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
