import { Router } from 'express';
import { query } from '../db/pool.ts';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';
import { hashSenha } from '../lib/auth.ts';

export const usersRouter = Router();
usersRouter.use(requireAuth, requirePermission(PERMISSIONS.USERS_MANAGE));

usersRouter.get('/', async (_req, res) => {
  const { rows } = await query(
    'SELECT id, email, nome, role, permissions, ativo, criado_em FROM users ORDER BY criado_em',
  );
  res.json({ users: rows });
});

usersRouter.post('/', async (req, res) => {
  const { email, senha, nome, role, permissions } = req.body ?? {};
  if (!email || !senha) { res.status(400).json({ erro: 'email e senha obrigatorios' }); return; }
  const hash = await hashSenha(senha);
  const { rows } = await query(
    `INSERT INTO users (email, senha_hash, nome, role, permissions)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, nome, role, permissions, ativo`,
    [String(email).toLowerCase(), hash, nome ?? null, role === 'admin' ? 'admin' : 'sub', permissions ?? []],
  );
  res.status(201).json({ user: rows[0] });
});

usersRouter.patch('/:id', async (req, res) => {
  const { nome, role, permissions, ativo, senha } = req.body ?? {};
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (nome !== undefined) { sets.push(`nome = $${i++}`); vals.push(nome); }
  if (role !== undefined) { sets.push(`role = $${i++}`); vals.push(role === 'admin' ? 'admin' : 'sub'); }
  if (permissions !== undefined) { sets.push(`permissions = $${i++}`); vals.push(permissions); }
  if (ativo !== undefined) { sets.push(`ativo = $${i++}`); vals.push(ativo); }
  if (senha) { sets.push(`senha_hash = $${i++}`); vals.push(await hashSenha(senha)); }
  if (!sets.length) { res.status(400).json({ erro: 'nada para atualizar' }); return; }
  vals.push(req.params.id);
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  res.json({ ok: true });
});

usersRouter.delete('/:id', async (req, res) => {
  await query('UPDATE users SET ativo = false WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});
