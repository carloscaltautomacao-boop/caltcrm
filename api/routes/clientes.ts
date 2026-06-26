import { Router } from 'express';
import { query } from '../db/pool.ts';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';
import { atualizarCliente, atualizarQualificacao, historicoMensagens, salvarMensagem } from '../services/clientes.ts';
import { eventosDoCliente } from '../services/agenda.ts';
import { listarAnotacoes, criarAnotacao, excluirAnotacao } from '../services/anotacoes.ts';
import { getConfig, updateConfig } from '../services/config.ts';
import { sendWhatsAppMedia, sendWhatsAppText, type WhatsAppMedia } from '../services/whatsapp.ts';

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

function mediatypeDe(mimetype: string, tipo?: string): WhatsAppMedia['mediatype'] {
  if (tipo === 'documento') return 'document';
  if (tipo === 'audio' || mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'document';
}

function limparBase64(valor: string): string {
  return valor.replace(/^data:[^;]+;base64,/, '');
}

function textoOuNull(valor: unknown): string | null {
  const texto = String(valor ?? '').trim();
  return texto || null;
}

function somenteDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

function numeroOuNull(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  const limpo = String(valor)
    .replace(/\s/g, '')
    .replace(/[R$]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

function dataOuNull(valor: unknown): string | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const m = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  const dia = m[1]!.padStart(2, '0');
  const mes = m[2]!.padStart(2, '0');
  const ano = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  return `${ano}-${mes}-${dia}`;
}

function controleMensalOuVazio(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const bruto = valor as Record<string, unknown>;
  const mensal: Record<string, string> = {};
  for (const mes of meses) {
    const status = String(bruto[mes] ?? '').trim().toUpperCase();
    if (['A', 'P', 'C'].includes(status)) mensal[mes] = status;
  }
  return mensal;
}

type LinhaControle = {
  origem_venda?: unknown;
  vendedor_responsavel?: unknown;
  nome?: unknown;
  cpf_cnpj?: unknown;
  grupo_cota?: unknown;
  telefone?: unknown;
  credito_vendido?: unknown;
  cidade?: unknown;
  estado?: unknown;
  etapa?: unknown;
  data_venda?: unknown;
  controle_mensal?: unknown;
};


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
    `SELECT c.*, c.renda_aproximada::float8 AS renda_aproximada,
            q.pretensao_bem, q.tipo_bem, q.credito_pretendido::float8 AS credito_pretendido, q.urgencia,
            q.valor_parcela_ideal::float8 AS valor_parcela_ideal, q.forma_contemplacao,
            q.interesse_lance, q.valor_lance::float8 AS valor_lance,
            q.prazo_desejado, q.completa AS qualificacao_completa
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id
       ${where} ORDER BY c.atualizado_em DESC LIMIT 500`,
    params,
  );
  res.json({ clientes: rows });
});

// Visao operacional no formato da planilha de controle comercial.
clientesRouter.get('/controle', requirePermission(PERMISSIONS.CLIENTES_VIEW), async (req, res) => {
  const { status, cidade, vendedor, inicio, fim, q } = req.query;
  const cond: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (status) { cond.push(`c.etapa = $${i++}`); params.push(status); }
  if (cidade) { cond.push(`unaccent(coalesce(c.cidade, '')) ILIKE unaccent($${i++})`); params.push(String(cidade)); }
  if (vendedor) { cond.push(`unaccent(coalesce(c.vendedor_responsavel, '')) ILIKE unaccent($${i++})`); params.push(String(vendedor)); }
  if (inicio) { cond.push(`c.data_venda >= $${i++}`); params.push(inicio); }
  if (fim) { cond.push(`c.data_venda <= $${i++}`); params.push(fim); }
  if (q) {
    cond.push(`(
      unaccent(coalesce(c.nome, '')) ILIKE unaccent($${i})
      OR c.telefone ILIKE $${i}
      OR coalesce(c.cpf_cnpj, '') ILIKE $${i}
      OR unaccent(coalesce(c.grupo_cota, '')) ILIKE unaccent($${i})
    )`);
    params.push(`%${q}%`);
    i++;
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT c.id, c.nome, c.telefone, c.cpf_cnpj, c.cidade, c.estado, c.etapa,
            c.origem_venda, c.vendedor_responsavel, c.grupo_cota,
            c.credito_vendido::float8 AS credito_vendido,
            c.data_venda, c.controle_mensal, c.criado_em, c.atualizado_em,
            q.credito_pretendido::float8 AS credito_pretendido
       FROM clientes c
       LEFT JOIN qualificacoes q ON q.cliente_id = c.id
       ${where}
      ORDER BY c.data_venda DESC NULLS LAST, c.atualizado_em DESC
      LIMIT 1000`,
    params,
  );
  res.json({ clientes: rows });
});

clientesRouter.post('/controle', requirePermission(PERMISSIONS.CLIENTES_EDIT), async (req, res) => {
  const linha = req.body as LinhaControle;
  const telefone = somenteDigitos(linha.telefone);
  if (!telefone) { res.status(400).json({ erro: 'telefone obrigatorio' }); return; }
  const campos = {
    telefone,
    nome: textoOuNull(linha.nome),
    cpf_cnpj: textoOuNull(linha.cpf_cnpj),
    cidade: textoOuNull(linha.cidade),
    estado: textoOuNull(linha.estado)?.toUpperCase(),
    etapa: textoOuNull(linha.etapa) || 'cliente_parceiro',
    origem_venda: textoOuNull(linha.origem_venda),
    vendedor_responsavel: textoOuNull(linha.vendedor_responsavel),
    grupo_cota: textoOuNull(linha.grupo_cota),
    credito_vendido: numeroOuNull(linha.credito_vendido),
    data_venda: dataOuNull(linha.data_venda),
    controle_mensal: controleMensalOuVazio(linha.controle_mensal),
  };
  const { rows } = await query(
    `INSERT INTO clientes (
       telefone, nome, cpf_cnpj, cidade, estado, etapa, origem, origem_venda,
       vendedor_responsavel, grupo_cota, credito_vendido, data_venda, controle_mensal
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'planilha', $7, $8, $9, $10, $11, $12::jsonb)
     ON CONFLICT (telefone) DO UPDATE SET
       nome = COALESCE(EXCLUDED.nome, clientes.nome),
       cpf_cnpj = COALESCE(EXCLUDED.cpf_cnpj, clientes.cpf_cnpj),
       cidade = COALESCE(EXCLUDED.cidade, clientes.cidade),
       estado = COALESCE(EXCLUDED.estado, clientes.estado),
       etapa = EXCLUDED.etapa,
       origem_venda = COALESCE(EXCLUDED.origem_venda, clientes.origem_venda),
       vendedor_responsavel = COALESCE(EXCLUDED.vendedor_responsavel, clientes.vendedor_responsavel),
       grupo_cota = COALESCE(EXCLUDED.grupo_cota, clientes.grupo_cota),
       credito_vendido = COALESCE(EXCLUDED.credito_vendido, clientes.credito_vendido),
       data_venda = COALESCE(EXCLUDED.data_venda, clientes.data_venda),
       controle_mensal = CASE
         WHEN EXCLUDED.controle_mensal = '{}'::jsonb THEN clientes.controle_mensal
         ELSE EXCLUDED.controle_mensal
       END,
       atualizado_em = now()
     RETURNING *`,
    [
      campos.telefone, campos.nome, campos.cpf_cnpj, campos.cidade, campos.estado, campos.etapa,
      campos.origem_venda, campos.vendedor_responsavel, campos.grupo_cota, campos.credito_vendido,
      campos.data_venda, JSON.stringify(campos.controle_mensal),
    ],
  );
  res.status(201).json({ cliente: rows[0] });
});

clientesRouter.post('/controle/importar', requirePermission(PERMISSIONS.CLIENTES_EDIT), async (req, res) => {
  const linhas = Array.isArray(req.body?.linhas) ? req.body.linhas as LinhaControle[] : [];
  if (!linhas.length) { res.status(400).json({ erro: 'nenhuma linha para importar' }); return; }
  const resultado = { inseridos: 0, atualizados: 0, ignorados: [] as { linha: number; motivo: string }[] };

  for (const [idx, linha] of linhas.entries()) {
    const telefone = somenteDigitos(linha.telefone);
    if (!telefone) {
      resultado.ignorados.push({ linha: idx + 1, motivo: 'telefone vazio' });
      continue;
    }
    const antes = await query<{ id: string }>('SELECT id FROM clientes WHERE telefone = $1', [telefone]);
    const campos = {
      telefone,
      nome: textoOuNull(linha.nome),
      cpf_cnpj: textoOuNull(linha.cpf_cnpj),
      cidade: textoOuNull(linha.cidade),
      estado: textoOuNull(linha.estado)?.toUpperCase(),
      etapa: textoOuNull(linha.etapa),
      origem_venda: textoOuNull(linha.origem_venda),
      vendedor_responsavel: textoOuNull(linha.vendedor_responsavel),
      grupo_cota: textoOuNull(linha.grupo_cota),
      credito_vendido: numeroOuNull(linha.credito_vendido),
      data_venda: dataOuNull(linha.data_venda),
      controle_mensal: controleMensalOuVazio(linha.controle_mensal),
    };
    await query(
      `INSERT INTO clientes (
         telefone, nome, cpf_cnpj, cidade, estado, etapa, origem, origem_venda,
         vendedor_responsavel, grupo_cota, credito_vendido, data_venda, controle_mensal
       )
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'cliente_parceiro'), 'planilha', $7, $8, $9, $10, $11, $12::jsonb)
       ON CONFLICT (telefone) DO UPDATE SET
         nome = COALESCE(EXCLUDED.nome, clientes.nome),
         cpf_cnpj = COALESCE(EXCLUDED.cpf_cnpj, clientes.cpf_cnpj),
         cidade = COALESCE(EXCLUDED.cidade, clientes.cidade),
         estado = COALESCE(EXCLUDED.estado, clientes.estado),
         etapa = COALESCE(EXCLUDED.etapa, clientes.etapa),
         origem_venda = COALESCE(EXCLUDED.origem_venda, clientes.origem_venda),
         vendedor_responsavel = COALESCE(EXCLUDED.vendedor_responsavel, clientes.vendedor_responsavel),
         grupo_cota = COALESCE(EXCLUDED.grupo_cota, clientes.grupo_cota),
         credito_vendido = COALESCE(EXCLUDED.credito_vendido, clientes.credito_vendido),
         data_venda = COALESCE(EXCLUDED.data_venda, clientes.data_venda),
         controle_mensal = CASE
           WHEN EXCLUDED.controle_mensal = '{}'::jsonb THEN clientes.controle_mensal
           ELSE EXCLUDED.controle_mensal
         END,
         atualizado_em = now()`,
      [
        campos.telefone, campos.nome, campos.cpf_cnpj, campos.cidade, campos.estado, campos.etapa,
        campos.origem_venda, campos.vendedor_responsavel, campos.grupo_cota, campos.credito_vendido,
        campos.data_venda, JSON.stringify(campos.controle_mensal),
      ],
    );
    if (antes.rows[0]) resultado.atualizados++;
    else resultado.inseridos++;
  }

  res.json({ resultado });
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
    `SELECT c.*, c.renda_aproximada::float8 AS renda_aproximada,
            q.pretensao_bem, q.tipo_bem, q.credito_pretendido::float8 AS credito_pretendido, q.urgencia,
            q.valor_parcela_ideal::float8 AS valor_parcela_ideal, q.forma_contemplacao,
            q.interesse_lance, q.valor_lance::float8 AS valor_lance,
            q.prazo_desejado, q.completa AS qualificacao_completa
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id WHERE c.id = $1`,
    [req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ erro: 'nao encontrado' }); return; }
  const mensagens = await historicoMensagens(req.params.id, 200);
  const eventos = await eventosDoCliente(req.params.id);
  res.json({ cliente: rows[0], mensagens, eventos });
});

clientesRouter.patch('/:id', requirePermission(PERMISSIONS.CLIENTES_EDIT), async (req, res) => {
  const corpo = req.body ?? {};
  await atualizarCliente(req.params.id, corpo);
  const qualificacao = await atualizarQualificacao(req.params.id, corpo);
  res.json({ ok: true, qualificacao });
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
