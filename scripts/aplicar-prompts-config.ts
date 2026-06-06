// One-off: grava os blocos de treinamento (persona/regras/roteiro/faq/base) atuais do codigo
// (TREINAMENTO_PADRAO) na linha de config do banco, para que producao passe a usar a config oficial
// da CALT (agente Carlos Alberto) imediatamente, sem depender de deploy. Faz BACKUP antes de sobrescrever.
//
// Rodar: npx tsx scripts/aplicar-prompts-config.ts
import '../api/load-env.ts'; // PRECISA ser o primeiro import (carrega .env antes do pool)
import { writeFileSync, existsSync } from 'node:fs';
import { query, pool } from '../api/db/pool.ts';
import { updateConfig } from '../api/services/config.ts';
import { TREINAMENTO_PADRAO } from '../api/agents/prompts.ts';

const TRAINING_KEYS = ['persona', 'regras_atendimento', 'roteiro_atendimento', 'faq', 'base_conhecimento'] as const;

async function main(): Promise<void> {
  // 1) Backup do que esta gravado HOJE (dados crus, nao o merge).
  const { rows } = await query<{ dados: Record<string, unknown> }>('SELECT dados FROM config WHERE id = 1');
  const raw = rows[0]?.dados ?? {};
  const backupPath = 'scripts/config-backup-pre-prompts.json';
  if (existsSync(backupPath)) {
    console.log(`[backup] ${backupPath} já existe — mantido (preserva o estado original).`);
  } else {
    writeFileSync(backupPath, JSON.stringify(raw, null, 2), 'utf8');
    console.log(`[backup] dados atuais salvos em ${backupPath}`);
  }

  const presentes = TRAINING_KEYS.filter((k) => typeof raw[k] === 'string' && (raw[k] as string).trim() !== '');
  console.log(`[antes] blocos de treinamento ja gravados no banco: ${presentes.length ? presentes.join(', ') : '(nenhum — usava o padrao do codigo)'}`);

  // 2) Aplica os blocos do codigo (config oficial CALT / Carlos Alberto). updateConfig faz merge raso,
  //    entao os campos operacionais (buffer, handoff, etc.) sao preservados.
  await updateConfig({
    persona: TREINAMENTO_PADRAO.persona,
    regras_atendimento: TREINAMENTO_PADRAO.regras_atendimento,
    roteiro_atendimento: TREINAMENTO_PADRAO.roteiro_atendimento,
    faq: TREINAMENTO_PADRAO.faq,
    base_conhecimento: TREINAMENTO_PADRAO.base_conhecimento,
  });

  // 3) Verificacao.
  const { rows: depois } = await query<{ dados: Record<string, string> }>('SELECT dados FROM config WHERE id = 1');
  const d = depois[0]?.dados ?? {};
  console.log('[depois] persona gravada:', JSON.stringify((d.persona ?? '').slice(0, 80)) + '...');
  console.log('[depois] base_conhecimento tem', (d.base_conhecimento ?? '').length, 'caracteres');
  console.log('[ok] config atualizada no banco.');
}

main()
  .catch((e) => {
    console.error('[ERRO]', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
