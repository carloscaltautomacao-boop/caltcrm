import type OpenAI from 'openai';
import { query } from '../db/pool.ts';
import { chat } from '../lib/ai.ts';
import { MODELOS } from '../lib/openai.ts';
import { logger } from '../lib/logger.ts';
import { montarSystemReativacao } from '../agents/prompts.ts';
import { getConfig, type ConfigAgente } from './config.ts';
import { sendWhatsAppText } from './whatsapp.ts';
import { salvarMensagem, historicoMensagens, recalcularQualificacao, atualizarCliente } from './clientes.ts';
import { agendarFollowUp, definirStatusEvento, ETAPAS_TERMINAIS } from './agenda.ts';

// Quantos follow-ups processar por execucao do cron. Cada disparo e uma chamada single-shot (~3-5s);
// com maxDuration de 180s, ~25 cabe com folga. Sobra fica para a proxima rodada (cron diario no Hobby).
const LOTE_MAX = 25;

interface FollowUpDevido {
  evento_id: string;
  toque: number | null;
  evento_criado: string;
  id: string; // cliente_id
  nome: string | null;
  telefone: string;
  whatsapp_jid: string | null;
  etapa: string;
}

export interface ResumoFollowUp {
  processados: number;
  enviados: number;
  cancelados: number;
  falhas: number;
}

// Motor da regua de reativacao. Idempotente e best-effort: uma falha num lead nao derruba o lote.
// Chamado pelo cron (routes/cron.ts). Cada follow-up vencido: revalida -> gera mensagem -> envia ->
// agenda o proximo toque (ou marca lead_frio no fim da regua).
export async function executarFollowUps(): Promise<ResumoFollowUp> {
  const resumo: ResumoFollowUp = { processados: 0, enviados: 0, cancelados: 0, falhas: 0 };
  const config = await getConfig();
  if (!config.follow_up_ativo) {
    logger.info('follow-up: regua desligada na config, nada a fazer');
    return resumo;
  }

  const { rows } = await query<FollowUpDevido>(
    `SELECT e.id AS evento_id, e.toque, e.criado_em AS evento_criado,
            c.id, c.nome, c.telefone, c.whatsapp_jid, c.etapa
       FROM eventos e JOIN clientes c ON c.id = e.cliente_id
      WHERE e.tipo = 'follow_up' AND e.status = 'pendente' AND e.inicio <= now()
      ORDER BY e.inicio ASC LIMIT $1`,
    [LOTE_MAX],
  );

  for (const row of rows) {
    resumo.processados++;
    try {
      if (!(await leadElegivel(row))) {
        await definirStatusEvento(row.evento_id, 'cancelado');
        resumo.cancelados++;
        continue;
      }
      const { faltando } = await recalcularQualificacao(row.id);
      const texto = await gerarReativacao(row, faltando, config);
      if (!texto) {
        await definirStatusEvento(row.evento_id, 'falhou');
        resumo.falhas++;
        continue;
      }
      await enviarReativacao(row, texto);
      await definirStatusEvento(row.evento_id, 'enviado');
      resumo.enviados++;
      await agendarProximoToque(row, config);
    } catch (e) {
      logger.error('follow-up: falha ao processar lead', { clienteId: row.id, erro: e });
      await definirStatusEvento(row.evento_id, 'falhou').catch(() => { /* best-effort */ });
      resumo.falhas++;
    }
  }

  logger.info('follow-up: lote processado', resumo);
  return resumo;
}

// Lead ainda merece reativacao? Nao, se: etapa terminal, humano assumiu o chat, ou ja respondeu desde o
// agendamento (o webhook ja cancela nesse caso, mas reconferimos no envio — cinto e suspensorio).
async function leadElegivel(row: FollowUpDevido): Promise<boolean> {
  if (ETAPAS_TERMINAIS.includes(row.etapa)) return false;
  const { rows } = await query<{ em_humano: boolean; respondeu: boolean }>(
    `SELECT
       EXISTS (SELECT 1 FROM sessoes s WHERE s.cliente_id = $1 AND s.status = 'humano') AS em_humano,
       EXISTS (SELECT 1 FROM mensagens m WHERE m.cliente_id = $1 AND m.direcao = 'in' AND m.criado_em > $2) AS respondeu`,
    [row.id, row.evento_criado],
  );
  const r = rows[0];
  return !!r && !r.em_humano && !r.respondeu;
}

// Uma chamada ao modelo (sem tools, sem buffer): retoma a conversa com base no historico.
async function gerarReativacao(row: FollowUpDevido, faltando: string[], config: ConfigAgente): Promise<string> {
  const historico = await historicoMensagens(row.id, 20);
  const system = montarSystemReativacao({
    persona: config.persona,
    regras_atendimento: config.regras_atendimento,
    nomeCliente: row.nome,
    qualificacaoFaltando: faltando,
    toque: row.toque ?? 1,
    instrucaoExtra: config.reativacao_instrucao,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...historico.map((m) => ({
      role: (m.direcao === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.conteudo ?? '',
    })),
    { role: 'user', content: '[O lead está há um tempo sem responder. Escreva agora a mensagem de reativação.]' },
  ];

  const resp = await chat({ origem: 'agente', model: MODELOS.agente, messages, clienteId: row.id });
  return resp.choices[0]?.message.content?.trim() ?? '';
}

// Envia como UMA mensagem (sem dividir em baloes/delays: o lote do cron precisa ser rapido).
async function enviarReativacao(row: FollowUpDevido, texto: string): Promise<void> {
  const destino = row.whatsapp_jid || row.telefone;
  await sendWhatsAppText(destino, texto);
  await salvarMensagem(row.id, 'out', 'texto', texto, 'ia');
}

// Agenda o proximo toque da regua; se foi o ultimo, encerra movendo o lead para lead_frio.
async function agendarProximoToque(row: FollowUpDevido, config: ConfigAgente): Promise<void> {
  const toques = config.follow_up_toques;
  const atual = row.toque ?? 1;
  if (atual >= toques.length) {
    await atualizarCliente(row.id, { etapa: 'lead_frio' });
    return;
  }
  await agendarFollowUp(row.id, atual + 1, Number(toques[atual]) || 24);
}
