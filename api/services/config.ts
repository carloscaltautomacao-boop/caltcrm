import { query } from '../db/pool.ts';
import { TREINAMENTO_PADRAO } from '../agents/prompts.ts';

export interface ConfigAgente {
  // --- Treinamento da IA (fonte PRINCIPAL do comportamento; editável na aba Configurações) ---
  persona: string;
  regras_atendimento: string;
  roteiro_atendimento: string;
  faq: string;
  base_conhecimento: string;
  // --- Operacional ---
  buffer_segundos: number; // agrupa mensagens picadas do lead antes de responder (0 = desligado)
  dividir_mensagens: boolean; // quebra a resposta em varios baloes curtos em vez de um textao
  digitacao_humanizada: boolean; // mostra "digitando..." (delay do Evolution) antes de cada balao
  follow_up_horas: number;
  segmentos: string[];
  emojis_apenas_saudacao: boolean;
  nao_se_despedir: boolean;
  custo_ia_teto_usd_mes: number; // 0 = sem teto (alerta de custo desligado)
  handoff: { carlos: string; rayane: string };
}

// Valores padrão. getConfig faz merge sobre eles, então uma config antiga em produção (sem os campos
// novos) passa a enxergar os defaults automaticamente — sem precisar de migration destrutiva.
const DEFAULTS: ConfigAgente = {
  persona: TREINAMENTO_PADRAO.persona,
  regras_atendimento: TREINAMENTO_PADRAO.regras_atendimento,
  roteiro_atendimento: TREINAMENTO_PADRAO.roteiro_atendimento,
  faq: TREINAMENTO_PADRAO.faq,
  base_conhecimento: TREINAMENTO_PADRAO.base_conhecimento,
  buffer_segundos: 8,
  dividir_mensagens: true,
  digitacao_humanizada: true,
  follow_up_horas: 24,
  segmentos: ['auto', 'imovel', 'solar'],
  emojis_apenas_saudacao: true,
  nao_se_despedir: true,
  custo_ia_teto_usd_mes: 0,
  handoff: { carlos: '', rayane: '' },
};

export async function getConfig(): Promise<ConfigAgente> {
  const { rows } = await query<{ dados: Partial<ConfigAgente> }>('SELECT dados FROM config WHERE id = 1');
  const dados = rows[0]?.dados ?? {};
  // Merge raso é suficiente; handoff é o único objeto aninhado, então mescla separado para não perder chaves.
  return { ...DEFAULTS, ...dados, handoff: { ...DEFAULTS.handoff, ...(dados.handoff ?? {}) } };
}

export async function updateConfig(patch: Partial<ConfigAgente>): Promise<ConfigAgente> {
  const atual = await getConfig();
  const novo: ConfigAgente = { ...atual, ...patch, handoff: { ...atual.handoff, ...(patch.handoff ?? {}) } };
  await query('UPDATE config SET dados = $1, atualizado_em = now() WHERE id = 1', [JSON.stringify(novo)]);
  return novo;
}
