import { query } from '../db/pool.ts';

// Tipos de evento. tarefa/lembrete/compromisso sao manuais (humano); follow_up e gerado pelo motor.
export type TipoEvento = 'tarefa' | 'lembrete' | 'compromisso' | 'follow_up';
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
  return rows[0]!;
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
}

export async function definirStatusEvento(id: string, status: StatusEvento): Promise<void> {
  await query(
    `UPDATE eventos SET status = $2,
       concluido_em = CASE WHEN $2 = 'concluido' THEN now() ELSE concluido_em END,
       atualizado_em = now()
     WHERE id = $1`,
    [id, status],
  );
}

export async function excluirEvento(id: string): Promise<void> {
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
  await query(
    `INSERT INTO eventos (cliente_id, tipo, titulo, descricao, inicio, status, canal, automatico, handoff_id)
     VALUES ($1, 'tarefa', $2, $3, now(), 'pendente', 'whatsapp', true, $4)`,
    [clienteId, `Fechar com ${nome || 'lead qualificado'}`, resumo || null, handoffId],
  );
}
