import { query } from '../db/pool.ts';

export interface Plano {
  id: number;
  segmento: string;
  bem: string | null;
  grupo: string | null;
  credito: number;
  prazo_meses: number;
  parcela: number;
  taxa_adm: number;
  ativo: boolean;
}

// Busca planos compativeis: mesmo segmento, credito proximo do pretendido (faixa +/- 30%).
// Ordena pela proximidade do credito; opcionalmente prioriza o prazo desejado.
export async function buscarPlanosCompativeis(
  segmento: string,
  credito: number,
  prazoMeses?: number,
): Promise<Plano[]> {
  const min = credito * 0.7;
  const max = credito * 1.3;
  const { rows } = await query<Plano>(
    `SELECT * FROM planos
      WHERE ativo = true AND segmento = $1 AND credito BETWEEN $2 AND $3
      ORDER BY abs(credito - $4) ASC,
               CASE WHEN $5::int IS NULL THEN 0 ELSE abs(prazo_meses - $5) END ASC
      LIMIT 5`,
    [segmento, min, max, credito, prazoMeses ?? null],
  );
  return rows;
}

export async function planosPorIds(ids: number[]): Promise<Plano[]> {
  if (!ids.length) return [];
  const { rows } = await query<Plano>('SELECT * FROM planos WHERE id = ANY($1)', [ids]);
  return rows;
}

// Formata as faixas de parcela em texto pronto para o WhatsApp (negrito com UM asterisco).
export function formatarSimulacao(planos: Plano[]): string {
  if (!planos.length) return 'No momento não encontrei planos compatíveis nessa faixa. Vou acionar o time para te ajudar.';
  const linhas = planos.map((p, i) => {
    const credito = p.credito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const parcela = p.parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    return `${i + 1}. Crédito ${credito} em ${p.prazo_meses}x de aprox. *${parcela}* (taxa adm ${p.taxa_adm}%)`;
  });
  return `Encontrei estas faixas pra você (valores estimados, sujeitos a confirmação):\n${linhas.join('\n')}`;
}
