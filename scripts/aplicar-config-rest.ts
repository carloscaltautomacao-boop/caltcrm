// Aplica a config oficial no Supabase via API REST (PostgREST + service key), sem passar pelo pooler pg
// (que estava com 'tenant/user not found'). Grava: os 5 blocos de treinamento, a TABELA DE CRÉDITOS
// estruturada + prazo, e o WhatsApp de handoff do Carlos. Faz BACKUP do estado atual antes.
//
// Rodar: npx tsx scripts/aplicar-config-rest.ts
import '../api/load-env.ts'; // carrega .env (SUPABASE_URL / SUPABASE_KEY)
import { writeFileSync, existsSync } from 'node:fs';
import {
  TREINAMENTO_PADRAO,
  TABELA_CREDITOS_PADRAO,
  TABELA_PRAZO_MESES_PADRAO,
} from '../api/agents/prompts.ts';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? '';
const HANDOFF_CARLOS = '558699651602'; // número do Carlos (recebe o resumo do lead)

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERRO] SUPABASE_URL/SUPABASE_KEY ausentes no .env');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function main(): Promise<void> {
  // 1) Estado atual (dados crus).
  const getResp = await fetch(`${SUPABASE_URL}/rest/v1/config?id=eq.1&select=dados`, { headers });
  if (!getResp.ok) throw new Error(`GET falhou: ${getResp.status} ${await getResp.text()}`);
  const atual = (await getResp.json()) as Array<{ dados: Record<string, unknown> }>;
  const raw = atual[0]?.dados ?? {};

  const backupPath = 'scripts/config-backup-pre-tabela.json';
  if (existsSync(backupPath)) {
    console.log(`[backup] ${backupPath} já existe — mantido.`);
  } else {
    writeFileSync(backupPath, JSON.stringify(raw, null, 2), 'utf8');
    console.log(`[backup] estado atual salvo em ${backupPath}`);
  }

  // 2) Novo dados: merge sobre o atual (preserva campos operacionais que não estamos tocando).
  const handoffAtual = (raw.handoff as Record<string, unknown>) ?? {};
  const novo = {
    ...raw,
    persona: TREINAMENTO_PADRAO.persona,
    regras_atendimento: TREINAMENTO_PADRAO.regras_atendimento,
    roteiro_atendimento: TREINAMENTO_PADRAO.roteiro_atendimento,
    faq: TREINAMENTO_PADRAO.faq,
    base_conhecimento: TREINAMENTO_PADRAO.base_conhecimento,
    tabela_creditos: TABELA_CREDITOS_PADRAO,
    tabela_prazo_meses: TABELA_PRAZO_MESES_PADRAO,
    handoff: { ...handoffAtual, carlos: HANDOFF_CARLOS },
  };

  // 3) PATCH.
  const patchResp = await fetch(`${SUPABASE_URL}/rest/v1/config?id=eq.1`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ dados: novo, atualizado_em: new Date().toISOString() }),
  });
  if (!patchResp.ok) throw new Error(`PATCH falhou: ${patchResp.status} ${await patchResp.text()}`);
  const depois = (await patchResp.json()) as Array<{ dados: Record<string, unknown> }>;
  const d = depois[0]?.dados ?? {};

  console.log('[ok] config gravada via REST.');
  console.log('  persona:', String(d.persona ?? '').slice(0, 60) + '...');
  console.log('  roteiro:', String(d.roteiro_atendimento ?? '').length, 'chars');
  console.log('  base_conhecimento:', String(d.base_conhecimento ?? '').length, 'chars');
  console.log('  tabela_creditos:', Array.isArray(d.tabela_creditos) ? d.tabela_creditos.length : 0, 'linhas');
  console.log('  tabela_prazo_meses:', d.tabela_prazo_meses);
  console.log('  handoff:', JSON.stringify(d.handoff));
}

main().catch((e) => {
  console.error('[ERRO]', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
