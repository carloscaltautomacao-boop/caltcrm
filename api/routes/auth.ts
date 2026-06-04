import { Router } from 'express';
import { query } from '../db/pool.ts';
import {
  conferirSenha, assinarToken, AUTH_COOKIE, cookieOptions, type TokenPayload,
} from '../lib/auth.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { Permission } from '../lib/permissions-list.ts';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) {
    res.status(400).json({ erro: 'email e senha obrigatorios' });
    return;
  }
  const { rows } = await query<{
    id: string; email: string; senha_hash: string; role: 'admin' | 'sub'; permissions: Permission[]; ativo: boolean;
  }>('SELECT id, email, senha_hash, role, permissions, ativo FROM users WHERE email = $1', [String(email).toLowerCase()]);

  const u = rows[0];
  if (!u || !u.ativo || !(await conferirSenha(senha, u.senha_hash))) {
    res.status(401).json({ erro: 'credenciais invalidas' });
    return;
  }

  const payload: TokenPayload = { sub: u.id, email: u.email, role: u.role, permissions: u.permissions };
  res.cookie(AUTH_COOKIE, assinarToken(payload), cookieOptions);
  res.json({ user: { id: u.id, email: u.email, role: u.role, permissions: u.permissions } });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
