import { query } from '../db/pool.ts';
import type { Periodo } from '../lib/period.ts';

export interface DashboardKpis {
  leads: number;
  clientesAtivos: number;
  taxaConversao: number; // %
  tempoMedioPrimeiraRespostaSeg: number | null;
  creditoQualificadoTotal: number;
  creditoFechadoTotal: number;
  pctComPerfil: number; // % com credito >= minimo
  porEtapa: { etapa: string; total: number }[];
  porSegmento: { segmento: string; total: number }[];
  porOrigem: { origem: string; total: number }[];
  custoIaUsd: number;
  // Pendencias "agora" (nao limitadas ao periodo) — trabalho em aberto na operacao.
  agendaPendentes: number;
  agendaAtrasados: number;
  handoffsAbertos: number;
}

export async function calcularKpis(p: Periodo, creditoMinimo: number): Promise<DashboardKpis> {
  const params = [p.de, p.ate];

  const [leads, ativos, tempo, creditos, perfil, etapas, segmentos, origens, custo, agenda, handoffs] = await Promise.all([
    query<{ n: string }>(`SELECT count(*)::text n FROM clientes WHERE criado_em >= $1 AND criado_em < $2`, params),
    query<{ n: string }>(`SELECT count(*)::text n FROM clientes WHERE etapa = 'cliente_ativo' AND criado_em >= $1 AND criado_em < $2`, params),
    query<{ s: number | null }>(
      `SELECT avg(extract(epoch FROM (primeira_resposta_em - criado_em)))::float s
         FROM clientes WHERE primeira_resposta_em IS NOT NULL AND criado_em >= $1 AND criado_em < $2`, params),
    query<{ qualificado: string | null; fechado: string | null }>(
      `SELECT
         coalesce(sum(q.credito_pretendido) FILTER (WHERE q.completa), 0)::text qualificado,
         coalesce(sum(q.credito_pretendido) FILTER (WHERE c.etapa = 'cliente_ativo'), 0)::text fechado
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id
       WHERE c.criado_em >= $1 AND c.criado_em < $2`, params),
    query<{ com: string; total: string }>(
      `SELECT
         count(*) FILTER (WHERE q.credito_pretendido >= $3)::text com,
         count(*)::text total
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id
       WHERE c.criado_em >= $1 AND c.criado_em < $2 AND q.credito_pretendido IS NOT NULL`,
      [...params, creditoMinimo]),
    query<{ etapa: string; total: string }>(
      `SELECT etapa, count(*)::text total FROM clientes WHERE criado_em >= $1 AND criado_em < $2 GROUP BY etapa`, params),
    query<{ segmento: string; total: string }>(
      `SELECT coalesce(q.pretensao_bem, 'indefinido') segmento, count(*)::text total
         FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id
         WHERE c.criado_em >= $1 AND c.criado_em < $2 GROUP BY 1`, params),
    query<{ origem: string; total: string }>(
      `SELECT coalesce(origem, 'indefinido') origem, count(*)::text total
         FROM clientes WHERE criado_em >= $1 AND criado_em < $2 GROUP BY 1`, params),
    query<{ usd: string | null }>(
      `SELECT coalesce(sum(custo_usd), 0)::text usd FROM ai_usage WHERE criado_em >= $1 AND criado_em < $2`, params),
    query<{ pendentes: string; atrasados: string }>(
      `SELECT count(*)::text pendentes,
              count(*) FILTER (WHERE inicio < now())::text atrasados
         FROM eventos WHERE status = 'pendente'`),
    query<{ n: string }>(`SELECT count(*)::text n FROM handoffs WHERE resolvido = false`),
  ]);

  const nLeads = Number(leads.rows[0]?.n ?? 0);
  const nAtivos = Number(ativos.rows[0]?.n ?? 0);
  const com = Number(perfil.rows[0]?.com ?? 0);
  const totalPerfil = Number(perfil.rows[0]?.total ?? 0);

  return {
    leads: nLeads,
    clientesAtivos: nAtivos,
    taxaConversao: nLeads ? Math.round((nAtivos / nLeads) * 1000) / 10 : 0,
    tempoMedioPrimeiraRespostaSeg: tempo.rows[0]?.s ?? null,
    creditoQualificadoTotal: Number(creditos.rows[0]?.qualificado ?? 0),
    creditoFechadoTotal: Number(creditos.rows[0]?.fechado ?? 0),
    pctComPerfil: totalPerfil ? Math.round((com / totalPerfil) * 1000) / 10 : 0,
    porEtapa: etapas.rows.map((r) => ({ etapa: r.etapa, total: Number(r.total) })),
    porSegmento: segmentos.rows.map((r) => ({ segmento: r.segmento, total: Number(r.total) })),
    porOrigem: origens.rows.map((r) => ({ origem: r.origem, total: Number(r.total) })),
    custoIaUsd: Number(custo.rows[0]?.usd ?? 0),
    agendaPendentes: Number(agenda.rows[0]?.pendentes ?? 0),
    agendaAtrasados: Number(agenda.rows[0]?.atrasados ?? 0),
    handoffsAbertos: Number(handoffs.rows[0]?.n ?? 0),
  };
}
