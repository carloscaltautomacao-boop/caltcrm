import { Router } from 'express';
import { query } from '../db/pool.ts';
import { requireAuth, requirePermission } from '../middleware/auth.ts';
import { PERMISSIONS } from '../lib/permissions-list.ts';
import {
  listarEventos,
  criarEvento,
  atualizarEvento,
  definirStatusEvento,
  excluirEvento,
  type StatusEvento,
} from '../services/agenda.ts';
import {
  concluirConexaoGoogle,
  desconectarGoogleCalendar,
  statusGoogleCalendar,
  urlAutorizacaoGoogle,
  validarStateGoogle,
} from '../services/google-calendar.ts';

export const agendaRouter = Router();
agendaRouter.use(requireAuth);

// Lista eventos por intervalo + filtros (alimenta a aba Calendario). `meus=1` restringe ao usuario logado.
agendaRouter.get('/', requirePermission(PERMISSIONS.AGENDA_VIEW), async (req, res) => {
  const { de, ate, tipo, status, meus } = req.query;
  const eventos = await listarEventos({
    de: de as string | undefined,
    ate: ate as string | undefined,
    tipo: tipo as string | undefined,
    status: status as string | undefined,
    responsavelId: meus === '1' ? req.user!.sub : (req.query.responsavel as string | undefined),
  });
  res.json({ eventos });
});

// Usuarios ativos para o seletor de responsavel (nao exige USERS_MANAGE; basta enxergar a agenda).
agendaRouter.get('/responsaveis', requirePermission(PERMISSIONS.AGENDA_VIEW), async (_req, res) => {
  const { rows } = await query(
    `SELECT id, nome, email FROM users WHERE ativo = true ORDER BY nome NULLS LAST, email`,
  );
  res.json({ responsaveis: rows });
});

agendaRouter.get('/google/status', requirePermission(PERMISSIONS.AGENDA_VIEW), async (_req, res) => {
  res.json(await statusGoogleCalendar());
});

agendaRouter.get('/google/connect', requirePermission(PERMISSIONS.CONFIG_EDIT), async (req, res) => {
  res.json({ url: urlAutorizacaoGoogle(req.user!.sub) });
});

agendaRouter.get('/google/callback', requirePermission(PERMISSIONS.CONFIG_EDIT), async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const erro = req.query.error as string | undefined;
  const appUrl = (process.env.VITE_APP_URL || '/').replace(/\/$/, '');
  if (erro) { res.redirect(`${appUrl}/?google_calendar=erro&motivo=${encodeURIComponent(erro)}`); return; }
  if (!code || !state) { res.status(400).send('Resposta OAuth incompleta.'); return; }
  try {
    validarStateGoogle(state, req.user!.sub);
    await concluirConexaoGoogle(code, req.user!.sub);
    res.redirect(`${appUrl}/?google_calendar=conectado`);
  } catch (e) {
    const motivo = e instanceof Error ? e.message : 'Falha ao conectar';
    res.redirect(`${appUrl}/?google_calendar=erro&motivo=${encodeURIComponent(motivo)}`);
  }
});

agendaRouter.delete('/google/connection', requirePermission(PERMISSIONS.CONFIG_EDIT), async (_req, res) => {
  await desconectarGoogleCalendar();
  res.json({ ok: true });
});

agendaRouter.post('/', requirePermission(PERMISSIONS.AGENDA_EDIT), async (req, res) => {
  const b = req.body ?? {};
  if (!b.titulo || !b.inicio) { res.status(400).json({ erro: 'titulo e inicio obrigatorios' }); return; }
  const evento = await criarEvento(b, req.user!.sub);
  res.status(201).json({ evento });
});

agendaRouter.patch('/:id', requirePermission(PERMISSIONS.AGENDA_EDIT), async (req, res) => {
  await atualizarEvento(req.params.id, req.body ?? {});
  res.json({ ok: true });
});

// Mudanca de status (concluir/cancelar/reabrir). Concluir grava concluido_em.
agendaRouter.post('/:id/status', requirePermission(PERMISSIONS.AGENDA_EDIT), async (req, res) => {
  const status = req.body?.status as StatusEvento | undefined;
  const validos: StatusEvento[] = ['pendente', 'concluido', 'cancelado', 'enviado', 'falhou'];
  if (!status || !validos.includes(status)) { res.status(400).json({ erro: 'status invalido' }); return; }
  await definirStatusEvento(req.params.id, status);
  res.json({ ok: true });
});

agendaRouter.delete('/:id', requirePermission(PERMISSIONS.AGENDA_EDIT), async (req, res) => {
  await excluirEvento(req.params.id);
  res.json({ ok: true });
});
