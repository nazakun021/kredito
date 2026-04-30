import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { unauthorized } from "../errors";

export interface AuthRequest extends Request {
  userId?: number;
}

export function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  // Cookie is primary; Authorization header accepted as fallback for API clients / tests
  const token =
    (req.cookies as Record<string, string | undefined>)?.kredito_token ??
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) return next(unauthorized("Unauthorized: No token provided"));

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: number };
    req.userId = decoded.userId;
    return next();
  } catch {
    return next(unauthorized("Unauthorized: Invalid token"));
  }
}
