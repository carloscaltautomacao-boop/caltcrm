import { Router } from 'express';
import { waitUntil } from '@vercel/functions';
import { logger } from '../lib/logger.ts';
import { normalizarNumero } from '../services/whatsapp.ts';
import { normalizarEntrada } from '../services/media.ts';
import { obterOuCriarPorTelefone, salvarMensagem } from '../services/clientes.ts';
import { processarComBuffer } from '../services/agente.ts';
import { sendWhatsAppText } from '../services/whatsapp.ts';

export const webhookRouter = Router();

// Endpoint UNICO de entrada de mensagens. SEM auth do painel (o Evolution autentica com apikey proprio).
webhookRouter.post('/evolution', (req, res) => {
  // Responde rapido (evita timeout do Evolution). O processamento da IA roda DEPOIS do 200.
  res.status(200).json({ ok: true });

  // CRITICO no serverless: a Vercel CONGELA a funcao assim que a resposta sai. Sem waitUntil, todo o
  // processamento abaixo (criar cliente, salvar mensagem, buffer, IA) nao chega a rodar. waitUntil mantem
  // a funcao viva ate a Promise terminar (dentro do maxDuration de 60s).
  const tarefa = processarWebhook(req.body);
  try {
    waitUntil(tarefa);
  } catch {
    // Fora do contexto da Vercel (dev local): a Promise ja esta rodando no servidor de vida longa.
  }
});

// Faz todo o trabalho pesado do webhook. Nunca lanca (try/catch interno) para nao gerar unhandled rejection.
async function processarWebhook(body: any): Promise<void> {
  try {
    if (body?.event !== 'messages.upsert' && body?.event !== 'MESSAGES_UPSERT') return;

    const data = body.data;
    const key = data?.key;
    if (!key || key.fromMe) return; // ignora o que a propria conta enviou

    // remoteJid pode vir como @lid em contas Business; prefira o numero real (@s.whatsapp.net) quando existir.
    const jidReal: string = data?.senderPn || key?.senderPn || key?.remoteJid || '';
    const telefone = normalizarNumero(jidReal);
    if (!telefone) return;

    const cliente = await obterOuCriarPorTelefone(telefone);
    const entrada = await normalizarEntrada(data.message ?? {}, cliente.id);
    if (!entrada.texto) return;

    const mensagemId = await salvarMensagem(cliente.id, 'in', entrada.tipo, entrada.texto, 'lead', key.id);

    // Comandos slash utilitarios (pre-handlers antes do agente) — respondem na hora, sem buffer.
    if (entrada.texto.trim().toLowerCase() === '/status') {
      await sendWhatsAppText(telefone, `Etapa atual: ${cliente.etapa}`);
      return;
    }

    // Buffer (debounce): agrupa mensagens picadas do lead antes de acionar a IA.
    await processarComBuffer(cliente, entrada.texto, mensagemId);
  } catch (e) {
    logger.error('webhook: erro no processamento', e);
  }
}
