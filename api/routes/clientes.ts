import { Router } from 'express';
import { query } from '../db/pool.ts';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';
import { atualizarCliente, historicoMensagens, salvarMensagem } from '../services/clientes.ts';
import { eventosDoCliente } from '../services/agenda.ts';
import { listarAnotacoes, criarAnotacao, excluirAnotacao } from '../services/anotacoes.ts';
import { getConfig, updateConfig } from '../services/config.ts';
import { sendWhatsAppAudio, sendWhatsAppMedia, sendWhatsAppText, type WhatsAppMedia } from '../services/whatsapp.ts';

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

function mediatypeDe(mimetype: string, tipo?: string): WhatsAppMedia['mediatype'] {
  if (tipo === 'documento') return 'document';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

function limparBase64(valor: string): string {
  return valor.replace(/^data:[^;]+;base64,/, '');
}

function normalizarDataUriAudio(valor: string, mimetype: string): string {
  if (valor.startsWith('data:')) return valor;
  return `data:${mimetype};base64,${valor}`;
}

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

// Respostas rapidas compartilhadas no chat.
clientesRouter.get('/respostas-rapidas', requirePermission(PERMISSIONS.CHAT_VIEW), async (_req, res) => {
  const { rows } = await query(
    `SELECT id, titulo, texto, criado_em FROM respostas_rapidas ORDER BY criado_em DESC LIMIT 100`,
  );
  res.json({ respostas: rows });
});

clientesRouter.post('/respostas-rapidas', requirePermission(PERMISSIONS.CHAT_SEND), async (req, res) => {
  const titulo = (req.body?.titulo ?? '').trim();
  const texto = (req.body?.texto ?? '').trim();
  if (!titulo || !texto) { res.status(400).json({ erro: 'titulo e texto obrigatorios' }); return; }
  const { rows } = await query(
    `INSERT INTO respostas_rapidas (titulo, texto, criado_por) VALUES ($1, $2, $3)
     RETURNING id, titulo, texto, criado_em`,
    [titulo, texto, req.user!.sub],
  );
  res.status(201).json({ resposta: rows[0] });
});

clientesRouter.delete('/respostas-rapidas/:respostaId', requirePermission(PERMISSIONS.CHAT_SEND), async (req, res) => {
  await query('DELETE FROM respostas_rapidas WHERE id = $1', [req.params.respostaId]);
  res.json({ ok: true });
});

// Texto PIX salvo para envio rapido no chat.
clientesRouter.get('/pix', requirePermission(PERMISSIONS.CHAT_VIEW), async (_req, res) => {
  const config = await getConfig();
  res.json({ pix_texto: config.pix_texto || '' });
});

clientesRouter.put('/pix', requirePermission(PERMISSIONS.CHAT_SEND), async (req, res) => {
  const pixTexto = (req.body?.pix_texto ?? '').trim();
  const config = await updateConfig({ pix_texto: pixTexto });
  res.json({ pix_texto: config.pix_texto || '' });
});

clientesRouter.get('/:id', requirePermission(PERMISSIONS.CLIENTES_VIEW), async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, q.pretensao_bem, q.tipo_bem, q.credito_pretendido, q.urgencia, q.completa AS qualificacao_completa
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id WHERE c.id = $1`,
    [req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ erro: 'nao encontrado' }); return; }
  const mensagens = await historicoMensagens(req.params.id, 200);
  const eventos = await eventosDoCliente(req.params.id);
  res.json({ cliente: rows[0], mensagens, eventos });
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
  const { rows } = await query<{ telefone: string; whatsapp_jid: string | null }>(
    'SELECT telefone, whatsapp_jid FROM clientes WHERE id = $1', [req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ erro: 'nao encontrado' }); return; }
  // Entrega no JID exato do lead (pode ser @lid); fallback no telefone para cadastros antigos.
  await sendWhatsAppText(rows[0].whatsapp_jid || rows[0].telefone, texto);
  await salvarMensagem(req.params.id, 'out', 'texto', texto, 'humano');
  res.json({ ok: true });
});

// Envio manual de documento/imagem/video/audio pelo painel.
clientesRouter.post('/:id/midia', requirePermission(PERMISSIONS.CHAT_SEND), async (req, res) => {
  const {
    mediaBase64,
    mimetype,
    fileName,
    caption,
    tipo,
  } = req.body ?? {};
  if (!mediaBase64 || !mimetype) { res.status(400).json({ erro: 'midia obrigatoria' }); return; }
  const { rows } = await query<{ telefone: string; whatsapp_jid: string | null }>(
    'SELECT telefone, whatsapp_jid FROM clientes WHERE id = $1', [req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ erro: 'nao encontrado' }); return; }

  const mediatype = mediatypeDe(String(mimetype), String(tipo || ''));
  const nomeArquivo = String(fileName || `arquivo-${Date.now()}`);
  const legenda = String(caption || '').trim();
  const destino = rows[0].whatsapp_jid || rows[0].telefone;
  const media = limparBase64(String(mediaBase64));

  if (String(tipo) === 'audio' || String(mimetype).startsWith('audio/')) {
    await sendWhatsAppAudio(destino, normalizarDataUriAudio(String(mediaBase64), String(mimetype)));
    await salvarMensagem(req.params.id, 'out', 'audio', nomeArquivo, 'humano');
    res.json({ ok: true });
    return;
  }

  await sendWhatsAppMedia(destino, {
    mediatype,
    mimetype: String(mimetype),
    media,
    fileName: nomeArquivo,
    caption: legenda || '',
  });
  await salvarMensagem(req.params.id, 'out', mediatype === 'image' ? 'imagem' : mediatype, legenda || nomeArquivo, 'humano');
  res.json({ ok: true });
});

clientesRouter.delete('/:id', requirePermission(PERMISSIONS.CLIENTES_DELETE), async (req, res) => {
  await query('DELETE FROM clientes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ----- Anotacoes do lead (notas livres no chat) -----

clientesRouter.get('/:id/anotacoes', requirePermission(PERMISSIONS.CHAT_VIEW), async (req, res) => {
  const anotacoes = await listarAnotacoes(req.params.id);
  res.json({ anotacoes });
});

clientesRouter.post('/:id/anotacoes', requirePermission(PERMISSIONS.CHAT_SEND), async (req, res) => {
  const texto = (req.body?.texto ?? '').trim();
  if (!texto) { res.status(400).json({ erro: 'texto obrigatorio' }); return; }
  const anotacao = await criarAnotacao(req.params.id, texto, req.user!.sub);
  res.status(201).json({ anotacao });
});

clientesRouter.delete('/:id/anotacoes/:notaId', requirePermission(PERMISSIONS.CHAT_SEND), async (req, res) => {
  await excluirAnotacao(req.params.notaId, req.params.id);
  res.json({ ok: true });
});
