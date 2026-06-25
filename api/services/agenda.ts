import { query } from '../db/pool.ts';
import {
  clienteGoogleCalendar,
  dataGoogle,
  isoEventoGoogle,
} from './google-calendar.ts';
import type { calendar_v3 } from 'googleapis';

// Tipos de evento. tarefa/lembrete/compromisso sao manuais (humano); follow_up e gerado pelo motor.
// 'mensagem' = WhatsApp agendado criado no chat: o app SO salva (status='pendente', canal='whatsapp',
//   descricao=texto a enviar); quem dispara e o n8n (le `GET /api/agenda?tipo=mensagem&status=pendente`
//   com `ate=<agora>`, envia pelo telefone do lead e marca `POST /api/agenda/:id/status` enviado/falhou).
//   Nao ha cron no app (decisao do CLAUDE.md) — o envio acontece por fora.
export type TipoEvento = 'tarefa' | 'lembrete' | 'compromisso' | 'follow_up' | 'mensagem';
export type StatusEvento = 'pendente' | 'concluido' | 'cancelado' | 'enviado' | 'falhou';

export interface Evento {
  id: string;
  cliente_id: string | null;
  tipo: TipoEvento;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  status: StatusEvento;
  canal: string | null;
  automatico: boolean;
  toque: number | null;
  responsavel_id: string | null;
  handoff_id: string | null;
  payload: Record<string, unknown>;
  concluido_em: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_etag: string | null;
  google_html_link: string | null;
  google_updated_at: string | null;
  sync_error: string | null;
}

// Evento enriquecido para o painel (nomes resolvidos por join).
export interface EventoView extends Evento {
  cliente_nome: string | null;
  cliente_telefone: string | null;
  responsavel_nome: string | null;
}

const SELECT_VIEW = `
  SELECT e.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone, u.nome AS responsavel_nome
    FROM eventos e
    LEFT JOIN clientes c ON c.id = e.cliente_id
    LEFT JOIN users u ON u.id = e.responsavel_id`;

// ----- Leitura (alimenta a aba Calendario) -----

export interface FiltroEventos {
  de?: string; // ISO (inclusive)
  ate?: string; // ISO (exclusive)
  tipo?: string;
  status?: string;
  responsavelId?: string;
}

export async function listarEventos(f: FiltroEventos): Promise<EventoView[]> {
  try {
    await sincronizarAgendaGoogle(f.de, f.ate);
  } catch {
    // O shadow local mantem a operacao e o n8n funcionando durante indisponibilidade/revogacao do Google.
  }
  const cond: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (f.de) { cond.push(`e.inicio >= $${i++}`); vals.push(f.de); }
  if (f.ate) { cond.push(`e.inicio < $${i++}`); vals.push(f.ate); }
  if (f.tipo) { cond.push(`e.tipo = $${i++}`); vals.push(f.tipo); }
  if (f.status) { cond.push(`e.status = $${i++}`); vals.push(f.status); }
  if (f.responsavelId) { cond.push(`e.responsavel_id = $${i++}`); vals.push(f.responsavelId); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await query<EventoView>(`${SELECT_VIEW} ${where} ORDER BY e.inicio ASC LIMIT 1000`, vals);
  return rows;
}

// Eventos abertos (pendentes/futuros) de um cliente — usado no detalhe/chat do lead.
export async function eventosDoCliente(clienteId: string): Promise<EventoView[]> {
  const { rows } = await query<EventoView>(
    `${SELECT_VIEW} WHERE e.cliente_id = $1 AND e.status IN ('pendente') ORDER BY e.inicio ASC`,
    [clienteId],
  );
  return rows;
}

// ----- Escrita manual (humano) -----

export interface NovoEvento {
  cliente_id?: string | null;
  tipo?: TipoEvento;
  titulo: string;
  descricao?: string | null;
  inicio: string;
  fim?: string | null;
  dia_inteiro?: boolean;
  canal?: string | null;
  responsavel_id?: string | null;
}

export async function criarEvento(ev: NovoEvento, criadoPor: string | null): Promise<Evento> {
  const { rows } = await query<Evento>(
    `INSERT INTO eventos (cliente_id, tipo, titulo, descricao, inicio, fim, dia_inteiro, canal, responsavel_id, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      ev.cliente_id ?? null,
      ev.tipo ?? 'tarefa',
      ev.titulo,
      ev.descricao ?? null,
      ev.inicio,
      ev.fim ?? null,
      ev.dia_inteiro ?? false,
      ev.canal ?? null,
      ev.responsavel_id ?? null,
      criadoPor,
    ],
  );
  const evento = rows[0]!;
  await enviarEventoAoGoogle(evento);
  return (await obterEvento(evento.id)) ?? evento;
}

const CAMPOS_EDITAVEIS: (keyof NovoEvento)[] = [
  'cliente_id', 'tipo', 'titulo', 'descricao', 'inicio', 'fim', 'dia_inteiro', 'canal', 'responsavel_id',
];

export async function atualizarEvento(id: string, patch: Partial<NovoEvento>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const c of CAMPOS_EDITAVEIS) {
    if (patch[c] !== undefined) { sets.push(`${c} = $${i++}`); vals.push(patch[c]); }
  }
  if (!sets.length) return;
  sets.push('atualizado_em = now()');
  vals.push(id);
  await query(`UPDATE eventos SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  const evento = await obterEvento(id);
  if (evento) await enviarEventoAoGoogle(evento);
}

export async function definirStatusEvento(id: string, status: StatusEvento): Promise<void> {
  await query(
    `UPDATE eventos SET status = $2,
       concluido_em = CASE WHEN $2 = 'concluido' THEN now() ELSE concluido_em END,
       atualizado_em = now()
     WHERE id = $1`,
    [id, status],
  );
  const evento = await obterEvento(id);
  if (evento) await enviarEventoAoGoogle(evento);
}

export async function excluirEvento(id: string): Promise<void> {
  const evento = await obterEvento(id);
  if (evento?.google_event_id) {
    const google = await clienteGoogleCalendar();
    if (google) {
      try {
        await google.calendar.events.delete({
          calendarId: evento.google_calendar_id || google.calendarId,
          eventId: evento.google_event_id,
        });
      } catch (e) {
        if (statusHttp(e) !== 404 && statusHttp(e) !== 410) throw e;
      }
    }
  }
  await query('DELETE FROM eventos WHERE id = $1', [id]);
}

// ----- Integracao com handoff -----

// Cria uma tarefa de fechamento a partir de um handoff (handoff vira item acionavel na agenda).
export async function criarTarefaHandoff(
  clienteId: string,
  handoffId: string | null,
  nome: string | null,
  resumo: string,
): Promise<void> {
  const { rows } = await query<Evento>(
    `INSERT INTO eventos (cliente_id, tipo, titulo, descricao, inicio, status, canal, automatico, handoff_id)
     VALUES ($1, 'tarefa', $2, $3, now(), 'pendente', 'whatsapp', true, $4)
     RETURNING *`,
    [clienteId, `Fechar com ${nome || 'lead qualificado'}`, resumo || null, handoffId],
  );
  if (rows[0]) await enviarEventoAoGoogle(rows[0]);
}

function statusHttp(erro: unknown): number | undefined {
  return (erro as { response?: { status?: number }; code?: number })?.response?.status
    ?? (erro as { code?: number })?.code;
}

async function obterEvento(id: string): Promise<Evento | null> {
  const { rows } = await query<Evento>('SELECT * FROM eventos WHERE id = $1', [id]);
  return rows[0] ?? null;
}

function propriedadesPrivadas(evento: Evento): Record<string, string> {
  return {
    calt_evento_id: evento.id,
    calt_tipo: evento.tipo,
    calt_status: evento.status,
    calt_cliente_id: evento.cliente_id ?? '',
    calt_automatico: evento.automatico ? '1' : '0',
    calt_canal: evento.canal ?? '',
  };
}

function corpoGoogle(evento: Evento): calendar_v3.Schema$Event {
  return {
    summary: evento.titulo,
    description: evento.descricao ?? undefined,
    ...dataGoogle(evento.inicio, evento.fim, evento.dia_inteiro),
    extendedProperties: { private: propriedadesPrivadas(evento) },
  };
}

// Envia o shadow/outbox ao Google. Falhas ficam registradas e sao tentadas novamente na proxima leitura.
async function enviarEventoAoGoogle(evento: Evento): Promise<void> {
  const google = await clienteGoogleCalendar();
  if (!google) {
    await query('UPDATE eventos SET sync_error = $2 WHERE id = $1', [evento.id, 'Google Calendar nao conectado']);
    return;
  }
  try {
    const resposta = evento.google_event_id
      ? await google.calendar.events.patch({
          calendarId: evento.google_calendar_id || google.calendarId,
          eventId: evento.google_event_id,
          requestBody: corpoGoogle(evento),
        })
      : await google.calendar.events.insert({
          calendarId: google.calendarId,
          requestBody: corpoGoogle(evento),
        });
    const g = resposta.data;
    await query(
      `UPDATE eventos SET
         google_event_id = $2, google_calendar_id = $3, google_etag = $4,
         google_html_link = $5, google_updated_at = $6, sync_error = NULL, atualizado_em = now()
       WHERE id = $1`,
      [evento.id, g.id, google.calendarId, g.etag ?? null, g.htmlLink ?? null, g.updated ?? null],
    );
  } catch (e) {
    if (evento.google_event_id && (statusHttp(e) === 404 || statusHttp(e) === 410)) {
      await query(
        `UPDATE eventos SET google_event_id = NULL, google_etag = NULL, google_html_link = NULL WHERE id = $1`,
        [evento.id],
      );
      await enviarEventoAoGoogle({ ...evento, google_event_id: null, google_etag: null, google_html_link: null });
      return;
    }
    const mensagem = e instanceof Error ? e.message : 'Falha ao sincronizar com Google Calendar';
    await query('UPDATE eventos SET sync_error = $2, atualizado_em = now() WHERE id = $1', [evento.id, mensagem.slice(0, 1000)]);
  }
}

async function reenviarPendentes(): Promise<void> {
  const { rows } = await query<Evento>(
    `SELECT * FROM eventos
      WHERE google_event_id IS NULL OR sync_error IS NOT NULL
      ORDER BY atualizado_em ASC LIMIT 50`,
  );
  for (const evento of rows) await enviarEventoAoGoogle(evento);
}

function tipoValido(valor: string | undefined): TipoEvento {
  const validos: TipoEvento[] = ['tarefa', 'lembrete', 'compromisso', 'follow_up', 'mensagem'];
  return validos.includes(valor as TipoEvento) ? valor as TipoEvento : 'compromisso';
}

function statusValido(valor: string | undefined, googleStatus: string | null | undefined): StatusEvento {
  if (googleStatus === 'cancelled') return 'cancelado';
  const validos: StatusEvento[] = ['pendente', 'concluido', 'cancelado', 'enviado', 'falhou'];
  return validos.includes(valor as StatusEvento) ? valor as StatusEvento : 'pendente';
}

async function importarEventoGoogle(g: calendar_v3.Schema$Event, calendarId: string): Promise<void> {
  if (!g.id) return;
  if (g.status === 'cancelled' && !g.start) {
    await query(
      `UPDATE eventos SET status = 'cancelado', google_etag = $3, google_updated_at = $4,
         sync_error = NULL, atualizado_em = now()
       WHERE google_calendar_id = $1 AND google_event_id = $2`,
      [calendarId, g.id, g.etag ?? null, g.updated ?? null],
    );
    return;
  }
  const inicio = isoEventoGoogle(g.start);
  if (!inicio) return;
  const fim = isoEventoGoogle(g.end);
  const privado = g.extendedProperties?.private ?? {};
  const idLocal = privado.calt_evento_id || null;
  const tipo = tipoValido(privado.calt_tipo);
  const status = statusValido(privado.calt_status, g.status);
  const clienteId = privado.calt_cliente_id || null;
  const automatico = privado.calt_automatico === '1';
  const canal = privado.calt_canal || null;
  const diaInteiro = Boolean(g.start?.date);

  if (idLocal) {
    const existente = await query<{ id: string }>('SELECT id FROM eventos WHERE id = $1', [idLocal]);
    if (existente.rows[0]) {
      await query(
        `UPDATE eventos SET
           titulo = $2, descricao = $3, inicio = $4, fim = $5, dia_inteiro = $6,
           google_event_id = $7, google_calendar_id = $8, google_etag = $9,
           google_html_link = $10, google_updated_at = $11, sync_error = NULL, atualizado_em = now()
         WHERE id = $1`,
        [idLocal, g.summary || '(Sem titulo)', g.description ?? null, inicio, fim, diaInteiro,
          g.id, calendarId, g.etag ?? null, g.htmlLink ?? null, g.updated ?? null],
      );
      return;
    }
  }

  await query(
    `INSERT INTO eventos
       (id, cliente_id, tipo, titulo, descricao, inicio, fim, dia_inteiro, status, canal, automatico,
        google_event_id, google_calendar_id, google_etag, google_html_link, google_updated_at, sync_error)
     VALUES
       (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, NULL)
     ON CONFLICT (google_calendar_id, google_event_id) WHERE google_event_id IS NOT NULL
     DO UPDATE SET
       titulo = EXCLUDED.titulo,
       descricao = EXCLUDED.descricao,
       inicio = EXCLUDED.inicio,
       fim = EXCLUDED.fim,
       dia_inteiro = EXCLUDED.dia_inteiro,
       google_etag = EXCLUDED.google_etag,
       google_html_link = EXCLUDED.google_html_link,
       google_updated_at = EXCLUDED.google_updated_at,
       sync_error = NULL,
       atualizado_em = now()`,
    [
      idLocal, clienteId, tipo, g.summary || '(Sem titulo)', g.description ?? null, inicio, fim,
      diaInteiro, status, canal, automatico, g.id, calendarId, g.etag ?? null, g.htmlLink ?? null,
      g.updated ?? null,
    ],
  );
}

// A listagem sempre consulta o Google, tornando-o a fonte de verdade. O shadow local recebe as mudancas.
export async function sincronizarAgendaGoogle(de?: string, ate?: string): Promise<void> {
  const google = await clienteGoogleCalendar();
  if (!google) return;
  await reenviarPendentes();
  let pageToken: string | undefined;
  do {
    const resposta = await google.calendar.events.list({
      calendarId: google.calendarId,
      timeMin: de,
      timeMax: ate,
      singleEvents: true,
      showDeleted: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
    });
    for (const evento of resposta.data.items ?? []) await importarEventoGoogle(evento, google.calendarId);
    pageToken = resposta.data.nextPageToken ?? undefined;
  } while (pageToken);
}
