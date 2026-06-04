import type { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE, verificarToken, temPermissao, type TokenPayload } from '../lib/auth.ts';
import type { Permission } from '../lib/permissions-list.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[AUTH_COOKIE];
  const payload = token ? verificarToken(token) : null;
  if (!payload) {
    res.status(401).json({ erro: 'nao autenticado' });
    return;
  }
  req.user = payload;
  next();
}

export function requirePermission(permissao: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ erro: 'nao autenticado' });
      return;
    }
    if (!temPermissao(req.user, permissao)) {
      res.status(403).json({ erro: 'sem permissao', permissao });
      return;
    }
    next();
  };
}
