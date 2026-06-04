import type OpenAI from 'openai';
import { openai, MODELOS, PRECO_USD_POR_MTOK } from './openai.ts';
import { query } from '../db/pool.ts';
import { logger } from './logger.ts';

type Origem = 'extrator' | 'agente' | 'visao' | 'audio';

interface ChatOpts {
  model?: string;
  origem: Origem;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  temperature?: number;
  jsonMode?: boolean;
  clienteId?: string;
}

function custoUsd(modelo: string, promptTok: number, complTok: number): number {
  const p = PRECO_USD_POR_MTOK[modelo];
  if (!p) return 0;
  return (promptTok / 1_000_000) * p.in + (complTok / 1_000_000) * p.out;
}

async function registrarUso(
  modelo: string,
  origem: Origem,
  usage: OpenAI.Completions.CompletionUsage | undefined,
  clienteId?: string,
): Promise<void> {
  const pt = usage?.prompt_tokens ?? 0;
  const ct = usage?.completion_tokens ?? 0;
  try {
    await query(
      `INSERT INTO ai_usage (modelo, origem, prompt_tokens, completion_tokens, total_tokens, custo_usd, cliente_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [modelo, origem, pt, ct, pt + ct, custoUsd(modelo, pt, ct), clienteId ?? null],
    );
  } catch (e) {
    // Nunca derrubar o atendimento por causa do tracking de custo.
    logger.error('ai_usage: falha ao registrar', e);
  }
}

// Chat completion central. Toda chamada de texto/tools passa por aqui (registra custo).
export async function chat(opts: ChatOpts): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const model = opts.model ?? MODELOS.agente;
  const resp = await openai.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    ...(opts.tools ? { tools: opts.tools, tool_choice: 'auto' } : {}),
    ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });
  await registrarUso(model, opts.origem, resp.usage, opts.clienteId);
  return resp;
}

// Visao: descreve uma imagem (base64) em texto estruturado para alimentar o extrator.
export async function descreverImagem(base64: string, mime: string, clienteId?: string): Promise<string> {
  const resp = await openai.chat.completions.create({
    model: MODELOS.visao,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Descreva objetivamente o que aparece nesta imagem enviada por um lead de consorcio (ex.: print de simulacao, foto de carro/imovel, documento). Extraia textos e numeros relevantes. Responda em pt-BR, sem opinar.',
          },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  });
  await registrarUso(MODELOS.visao, 'visao', resp.usage, clienteId);
  return resp.choices[0]?.message.content ?? '';
}

// Transcricao de audio (Whisper). Recebe o buffer do audio.
export async function transcreverAudio(buffer: Buffer, clienteId?: string): Promise<string> {
  const file = new File([new Uint8Array(buffer)], 'audio.ogg', { type: 'audio/ogg' });
  const resp = await openai.audio.transcriptions.create({
    file,
    model: MODELOS.audio,
    language: 'pt',
  });
  // Whisper e cobrado por minuto; registramos a chamada para visibilidade (custo estimado a parte).
  await registrarUso(MODELOS.audio, 'audio', undefined, clienteId);
  return resp.text;
}
