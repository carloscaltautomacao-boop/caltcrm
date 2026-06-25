// One-off: atualiza somente os blocos de treinamento no Supabase via REST.
// Preserva tabela de créditos, handoff e toda a configuração operacional.
import '../api/load-env.ts';
import { existsSync, writeFileSync } from 'node:fs';
import { TREINAMENTO_PADRAO } from '../api/agents/prompts.ts';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL/SUPABASE_KEY ausentes');
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function main(): Promise<void> {
  const getResp = await fetch(`${SUPABASE_URL}/rest/v1/config?id=eq.1&select=dados`, { headers });
  if (!getResp.ok) throw new Error(`GET falhou: ${getResp.status} ${await getResp.text()}`);

  const rows = (await getResp.json()) as Array<{ dados: Record<string, unknown> }>;
  const atual = rows[0]?.dados;
  if (!atual) throw new Error('Config id=1 não encontrada');

  const backupPath = 'scripts/config-backup-pre-correcao-lance-documentos.json';
  if (!existsSync(backupPath)) {
    writeFileSync(backupPath, JSON.stringify(atual, null, 2), 'utf8');
    console.log(`[backup] ${backupPath}`);
  }

  const novo = {
    ...atual,
    persona: TREINAMENTO_PADRAO.persona,
    regras_atendimento: TREINAMENTO_PADRAO.regras_atendimento,
    roteiro_atendimento: TREINAMENTO_PADRAO.roteiro_atendimento,
    faq: TREINAMENTO_PADRAO.faq,
    base_conhecimento: TREINAMENTO_PADRAO.base_conhecimento,
  };

  const patchResp = await fetch(`${SUPABASE_URL}/rest/v1/config?id=eq.1`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ dados: novo, atualizado_em: new Date().toISOString() }),
  });
  if (!patchResp.ok) throw new Error(`PATCH falhou: ${patchResp.status} ${await patchResp.text()}`);

  const atualizados = (await patchResp.json()) as Array<{ dados: Record<string, unknown> }>;
  const dados = atualizados[0]?.dados ?? {};
  const roteiro = String(dados.roteiro_atendimento ?? '');
  const regras = String(dados.regras_atendimento ?? '');

  if (roteiro.includes('O lance pode ser embutido (usando até 30%')) {
    throw new Error('Verificação falhou: oferta indevida de lance ainda está no roteiro');
  }
  if (!regras.includes('Aceitar falar com um consultor para tirar dúvidas NÃO é intenção de fechamento')) {
    throw new Error('Verificação falhou: regra de documentos não foi persistida');
  }

  console.log('[ok] treinamento atualizado e verificado no Supabase');
}

main().catch((erro) => {
  console.error('[ERRO]', erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
