import { Router } from 'express';
import { query } from '../db/pool.ts';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';
import { atualizarCliente, historicoMensagens, salvarMensagem } from '../services/clientes.ts';
import { sendWhatsAppText } from '../services/whatsapp.ts';

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

// Lista com filtros simples (etapa, busca por nome/telefone) — alimenta Clientes e Kanban.
clientesRouter.get('/', requirePermission(PERMISSIONS.CLIENTES_VIEW), async (req, res) => {
  const { etapa, q } = req.query;
  const cond: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (etapa) { cond.push(`etapa = $${i++}`); params.push(etapa); }
  if (q) {
    cond.push(`(unaccent(coalesce(nome,'')) ILIKE unaccent($${i}) OR telefone ILIKE $${i})`);
    params.push(`%${q}%`); i++;
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT c.*, q.pretensao_bem, q.credito_pretendido, q.urgencia, q.completa AS qualificacao_completa
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id
       ${where} ORDER BY c.atualizado_em DESC LIMIT 500`,
    params,
  );
  res.json({ clientes: rows });
});

clientesRouter.get('/:id', requirePermission(PERMISSIONS.CLIENTES_VIEW), async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, q.pretensao_bem, q.tipo_bem, q.credito_pretendido, q.urgencia, q.completa AS qualificacao_completa
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id WHERE c.id = $1`,
    [req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ erro: 'nao encontrado' }); return; }
  const mensagens = await historicoMensagens(req.params.id, 200);
  res.json({ cliente: rows[0], mensagens });
});

clientesRouter.patch('/:id', requirePermission(PERMISSIONS.CLIENTES_EDIT), async (req, res) => {
  await atualizarCliente(req.params.id, req.body ?? {});
  res.json({ ok: true });
});

// Mover card no Kanban (atualiza etapa).
clientesRouter.patch('/:id/etapa', requirePermission(PERMISSIONS.KANBAN_EDIT), async (req, res) => {
  const { etapa } = req.body ?? {};
  if (!etapa) { res.status(400).json({ erro: 'etapa obrigatoria' }); return; }
  await atualizarCliente(req.params.id, { etapa });
  res.json({ ok: true });
});

// Mensagem manual de um humano (operador assume o chat).
clientesRouter.post('/:id/mensagem', requirePermission(PERMISSIONS.CHAT_SEND), async (req, res) => {
  const { texto } = req.body ?? {};
  if (!texto) { res.status(400).json({ erro: 'texto obrigatorio' }); return; }
  const { rows } = await query<{ telefone: string }>('SELECT telefone FROM clientes WHERE id = $1', [req.params.id]);
  if (!rows[0]) { res.status(404).json({ erro: 'nao encontrado' }); return; }
  await sendWhatsAppText(rows[0].telefone, texto);
  await salvarMensagem(req.params.id, 'out', 'texto', texto, 'humano');
  res.json({ ok: true });
});

clientesRouter.delete('/:id', requirePermission(PERMISSIONS.CLIENTES_DELETE), async (req, res) => {
  await query('DELETE FROM clientes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});
