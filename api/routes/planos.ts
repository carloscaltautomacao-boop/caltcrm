import { Router } from 'express';
import { query } from '../db/pool.ts';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';

export const planosRouter = Router();
planosRouter.use(requireAuth);

planosRouter.get('/', requirePermission(PERMISSIONS.PLANOS_VIEW), async (req, res) => {
  const { segmento } = req.query;
  const { rows } = await query(
    `SELECT * FROM planos ${segmento ? 'WHERE segmento = $1' : ''} ORDER BY segmento, credito`,
    segmento ? [segmento] : [],
  );
  res.json({ planos: rows });
});

planosRouter.post('/', requirePermission(PERMISSIONS.PLANOS_EDIT), async (req, res) => {
  const { segmento, bem, grupo, credito, prazo_meses, parcela, taxa_adm } = req.body ?? {};
  if (!segmento || !credito || !prazo_meses || !parcela || taxa_adm == null) {
    res.status(400).json({ erro: 'campos obrigatorios faltando' });
    return;
  }
  const { rows } = await query(
    `INSERT INTO planos (segmento, bem, grupo, credito, prazo_meses, parcela, taxa_adm)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [segmento, bem ?? null, grupo ?? null, credito, prazo_meses, parcela, taxa_adm],
  );
  res.status(201).json({ plano: rows[0] });
});

planosRouter.patch('/:id', requirePermission(PERMISSIONS.PLANOS_EDIT), async (req, res) => {
  const campos = ['segmento', 'bem', 'grupo', 'credito', 'prazo_meses', 'parcela', 'taxa_adm', 'ativo'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const c of campos) {
    if (req.body?.[c] !== undefined) { sets.push(`${c} = $${i++}`); vals.push(req.body[c]); }
  }
  if (!sets.length) { res.status(400).json({ erro: 'nada para atualizar' }); return; }
  vals.push(req.params.id);
  await query(`UPDATE planos SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  res.json({ ok: true });
});

planosRouter.delete('/:id', requirePermission(PERMISSIONS.PLANOS_EDIT), async (req, res) => {
  await query('UPDATE planos SET ativo = false WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});
