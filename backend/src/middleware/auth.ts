import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/pool';

export const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_STRONG_SECRET_64_CHARS_MIN';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: string; jti: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const session = await queryOne(
      `SELECT id FROM sessions WHERE token_jti = $1 AND user_id = $2 AND expires_at > NOW()`,
      [payload.jti, payload.sub]
    );
    if (!session) { res.status(401).json({ error: 'Session expired or revoked' }); return; }

    const user = await queryOne<{ id: number; email: string; role: string; is_active: boolean }>(
      `SELECT id, email, role, is_active FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (!user || !user.is_active) { res.status(401).json({ error: 'Account disabled' }); return; }

    req.user = { id: user.id, email: user.email, role: user.role, jti: payload.jti };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireNotViewer = requireRole('admin', 'sales_rep');
