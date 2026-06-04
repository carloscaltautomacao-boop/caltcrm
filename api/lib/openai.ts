import OpenAI from 'openai';

// Client singleton do provedor de IA. Trocar de provedor = mexer so aqui + em ai.ts.
// Placeholder evita que o construtor estoure no boot quando a chave ainda nao foi configurada
// (chamadas de IA falham em runtime com 401, mas o servidor/painel sobem normalmente).
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-key-nao-configurada',
});

// Modelos por uso (ver padroes-evolution-ia.md). Ajustar por custo/nicho.
export const MODELOS = {
  extrator: 'gpt-4.1',
  agente: 'gpt-4.1',
  visao: 'gpt-4o',
  audio: 'whisper-1',
} as const;

// Preco aproximado por 1M tokens (USD) para estimar custo em ai_usage. Atualizar conforme tabela vigente.
export const PRECO_USD_POR_MTOK: Record<string, { in: number; out: number }> = {
  'gpt-4.1': { in: 2.0, out: 8.0 },
  'gpt-4o': { in: 2.5, out: 10.0 },
  'whisper-1': { in: 0, out: 0 }, // cobrado por minuto; tratado a parte
};
