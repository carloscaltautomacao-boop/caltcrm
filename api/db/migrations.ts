import { pool, query } from './pool.ts';
import { hashSenha } from '../lib/auth.ts';
import { logger } from '../lib/logger.ts';
import { ALL_PERMISSIONS } from '../lib/permissions-list.ts';

// DDL 100% idempotente: roda no boot. Mudanca destrutiva so com migration versionada (ver docs/DECISIONS.md).
const DDL: string[] = [
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
  `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  `CREATE EXTENSION IF NOT EXISTS unaccent`,

  // ----- Usuarios do painel -----
  `CREATE TABLE IF NOT EXISTS users (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     email text UNIQUE NOT NULL,
     senha_hash text NOT NULL,
     nome text,
     role text NOT NULL DEFAULT 'sub',
     permissions text[] NOT NULL DEFAULT '{}',
     ativo boolean NOT NULL DEFAULT true,
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,

  // ----- Clientes (leads) -----
  `CREATE TABLE IF NOT EXISTS clientes (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     nome text,
     telefone text UNIQUE NOT NULL,
     cidade text,
     estado text,
     profissao text,
     renda_aproximada numeric,
     recebe_bolsa_familia boolean,
     entende_consorcio boolean,
     origem text DEFAULT 'trafego',
     etapa text NOT NULL DEFAULT 'novo',
     tags text[] NOT NULL DEFAULT '{}',
     vip boolean NOT NULL DEFAULT false,
     primeira_resposta_em timestamptz,
     criado_em timestamptz NOT NULL DEFAULT now(),
     atualizado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_etapa ON clientes (etapa)`,
  `CREATE INDEX IF NOT EXISTS idx_clientes_criado ON clientes (criado_em)`,
  // JID entregavel do WhatsApp (o remoteJid EXATO em que o lead falou: ex. 5511...@s.whatsapp.net ou
  // 178843210006771@lid). e PARA ONDE a resposta tem de ir. Contas LID-migradas so recebem no @lid; o
  // numero canonicalizado (telefone) serve so para identidade/dedup, NUNCA para entregar. Ver whatsapp.ts.
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS whatsapp_jid text`,
  // Dados complementares da ficha comercial. Todos opcionais para preservar leads antigos.
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email text`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf_cnpj text`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento date`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado_civil text`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS melhor_horario_contato text`,
  `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS observacoes text`,

  // ----- Qualificacao (1:1 com cliente) -----
  `CREATE TABLE IF NOT EXISTS qualificacoes (
     cliente_id uuid PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
     pretensao_bem text,
     tipo_bem text,
     credito_pretendido numeric,
     urgencia text,
     completa boolean NOT NULL DEFAULT false,
     atualizado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE qualificacoes ADD COLUMN IF NOT EXISTS valor_parcela_ideal numeric`,
  `ALTER TABLE qualificacoes ADD COLUMN IF NOT EXISTS forma_contemplacao text`,
  `ALTER TABLE qualificacoes ADD COLUMN IF NOT EXISTS interesse_lance boolean`,
  `ALTER TABLE qualificacoes ADD COLUMN IF NOT EXISTS valor_lance numeric`,
  `ALTER TABLE qualificacoes ADD COLUMN IF NOT EXISTS prazo_desejado int`,

  // ----- Catalogo de planos (tabela pronta) -----
  `CREATE TABLE IF NOT EXISTS planos (
     id serial PRIMARY KEY,
     segmento text NOT NULL,
     bem text,
     grupo text,
     credito numeric NOT NULL,
     prazo_meses int NOT NULL,
     parcela numeric NOT NULL,
     taxa_adm numeric NOT NULL,
     ativo boolean NOT NULL DEFAULT true,
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_planos_segmento ON planos (segmento)`,
  `CREATE INDEX IF NOT EXISTS idx_planos_credito ON planos (credito)`,
  `CREATE INDEX IF NOT EXISTS idx_planos_bem_trgm ON planos USING gin (bem gin_trgm_ops)`,

  // ----- Simulacoes enviadas -----
  `CREATE SEQUENCE IF NOT EXISTS simulacao_seq START 1`,
  `CREATE TABLE IF NOT EXISTS simulacoes (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     numero text UNIQUE,
     cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
     segmento text,
     credito numeric,
     planos jsonb NOT NULL DEFAULT '[]',
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,

  // ----- Sessao de atendimento (1 ativa por contato) -----
  `CREATE TABLE IF NOT EXISTS sessoes (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
     status text NOT NULL DEFAULT 'ativa',
     acao_pendente jsonb,
     onboarding_ok boolean NOT NULL DEFAULT false,
     ultima_interacao timestamptz NOT NULL DEFAULT now(),
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sessoes_cliente ON sessoes (cliente_id)`,

  // ----- Mensagens (espelho do chat) -----
  `CREATE TABLE IF NOT EXISTS mensagens (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
     direcao text NOT NULL,
     tipo text NOT NULL DEFAULT 'texto',
     conteudo text,
     origem text DEFAULT 'lead',
     evolution_id text,
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_mensagens_cliente ON mensagens (cliente_id, criado_em)`,

  // ----- Handoffs (acionamento humano) -----
  `CREATE TABLE IF NOT EXISTS handoffs (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
     motivo text NOT NULL,
     destino text NOT NULL DEFAULT 'carlos',
     resolvido boolean NOT NULL DEFAULT false,
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_handoffs_aberto ON handoffs (resolvido, criado_em)`,

  // ----- Agenda / Calendario (eventos polimorficos) -----
  // Espinha dorsal da aba Calendario: tudo que tem "quando" + "o que fazer" vira um evento.
  //   tipo='tarefa'|'lembrete'      -> gestao manual (humano cria/atribui/conclui)
  //   tipo='compromisso'            -> reuniao/prazo (ex.: data do "agendou_pagamento")
  //   tipo='follow_up'              -> gerado pelo motor de reativacao (automatico=true)
  // Datas em UTC (timestamptz); o front renderiza em America/Sao_Paulo. Ver services/agenda.ts.
  `CREATE TABLE IF NOT EXISTS eventos (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
     tipo text NOT NULL DEFAULT 'tarefa',
     titulo text NOT NULL,
     descricao text,
     inicio timestamptz NOT NULL,
     fim timestamptz,
     dia_inteiro boolean NOT NULL DEFAULT false,
     status text NOT NULL DEFAULT 'pendente',
     canal text,
     automatico boolean NOT NULL DEFAULT false,
     toque int,
     responsavel_id uuid REFERENCES users(id) ON DELETE SET NULL,
     handoff_id uuid REFERENCES handoffs(id) ON DELETE SET NULL,
     payload jsonb NOT NULL DEFAULT '{}',
     concluido_em timestamptz,
     criado_por uuid REFERENCES users(id) ON DELETE SET NULL,
     criado_em timestamptz NOT NULL DEFAULT now(),
     atualizado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_eventos_inicio ON eventos (inicio)`,
  `CREATE INDEX IF NOT EXISTS idx_eventos_status_inicio ON eventos (status, inicio)`,
  `CREATE INDEX IF NOT EXISTS idx_eventos_cliente ON eventos (cliente_id, inicio)`,
  // Garante NO MAXIMO 1 follow-up pendente por lead (idempotencia contra webhooks concorrentes).
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_followup_pendente
     ON eventos (cliente_id) WHERE tipo = 'follow_up' AND status = 'pendente'`,
  // O Google Calendar e a fonte de verdade da agenda. `eventos` permanece como shadow/outbox para
  // metadados do CRM (lead, status, handoff e fila de mensagens do n8n).
  `ALTER TABLE eventos ADD COLUMN IF NOT EXISTS google_event_id text`,
  `ALTER TABLE eventos ADD COLUMN IF NOT EXISTS google_calendar_id text`,
  `ALTER TABLE eventos ADD COLUMN IF NOT EXISTS google_etag text`,
  `ALTER TABLE eventos ADD COLUMN IF NOT EXISTS google_html_link text`,
  `ALTER TABLE eventos ADD COLUMN IF NOT EXISTS google_updated_at timestamptz`,
  `ALTER TABLE eventos ADD COLUMN IF NOT EXISTS sync_error text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_eventos_google
     ON eventos (google_calendar_id, google_event_id) WHERE google_event_id IS NOT NULL`,

  // Conexao organizacional unica com o Google Calendar. O refresh token e cifrado pela aplicacao.
  `CREATE TABLE IF NOT EXISTS google_calendar_conexoes (
     id int PRIMARY KEY DEFAULT 1,
     refresh_token_cifrado text NOT NULL,
     conta_email text,
     calendar_id text NOT NULL DEFAULT 'primary',
     calendar_nome text,
     scopes text[] NOT NULL DEFAULT '{}',
     conectado_por uuid REFERENCES users(id) ON DELETE SET NULL,
     conectado_em timestamptz NOT NULL DEFAULT now(),
     atualizado_em timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT google_calendar_singleton CHECK (id = 1)
   )`,

  // ----- Anotacoes (notas livres sobre o lead, criadas no chat) -----
  // Texto curto sem "quando" (diferente de eventos). Aparece no painel de anotacoes do chat.
  `CREATE TABLE IF NOT EXISTS anotacoes (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
     texto text NOT NULL,
     criado_por uuid REFERENCES users(id) ON DELETE SET NULL,
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_anotacoes_cliente ON anotacoes (cliente_id, criado_em DESC)`,

  // ----- Respostas rapidas do chat -----
  `CREATE TABLE IF NOT EXISTS respostas_rapidas (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     titulo text NOT NULL,
     texto text NOT NULL,
     criado_por uuid REFERENCES users(id) ON DELETE SET NULL,
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_respostas_rapidas_criado ON respostas_rapidas (criado_em DESC)`,

  // ----- Tracking de custo de IA -----
  `CREATE TABLE IF NOT EXISTS ai_usage (
     id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
     modelo text NOT NULL,
     origem text NOT NULL,
     prompt_tokens int NOT NULL DEFAULT 0,
     completion_tokens int NOT NULL DEFAULT 0,
     total_tokens int NOT NULL DEFAULT 0,
     custo_usd numeric NOT NULL DEFAULT 0,
     cliente_id uuid,
     criado_em timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_usage_criado ON ai_usage (criado_em)`,

  // ----- Config (linha unica) -----
  `CREATE TABLE IF NOT EXISTS config (
     id int PRIMARY KEY DEFAULT 1,
     dados jsonb NOT NULL DEFAULT '{}',
     atualizado_em timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT config_singleton CHECK (id = 1)
   )`,
];

// Config padrao do agente (instalacao nova). Os blocos de treinamento da IA vem dos DEFAULTS em
// services/config.ts (getConfig faz o merge), entao aqui so semeamos o operacional + o handoff do env.
const CONFIG_PADRAO = {
  emojis_apenas_saudacao: true,
  nao_se_despedir: true,
  segmentos: ['auto', 'imovel', 'solar'],
  buffer_segundos: 8,
  follow_up_horas: 24,
  custo_ia_teto_usd_mes: 0,
  handoff: {
    carlos: process.env.HANDOFF_WHATSAPP_CARLOS || '',
    rayane: process.env.HANDOFF_WHATSAPP_RAYANE || '',
  },
};

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const stmt of DDL) {
      await client.query(stmt);
    }
    logger.info('migrations: schema sincronizado');
  } finally {
    client.release();
  }
  await seedInitialData();
}

async function seedInitialData(): Promise<void> {
  // Admin inicial so quando a tabela esta vazia.
  const { rows } = await query<{ count: string }>('SELECT count(*)::text FROM users');
  if (rows[0]?.count === '0') {
    const email = process.env.ADMIN_INITIAL_EMAIL;
    const senha = process.env.ADMIN_INITIAL_PASSWORD;
    if (email && senha) {
      const hash = await hashSenha(senha);
      await query(
        `INSERT INTO users (email, senha_hash, nome, role, permissions)
         VALUES ($1, $2, $3, 'admin', $4)`,
        [email.toLowerCase(), hash, 'Admin CALT', ALL_PERMISSIONS],
      );
      logger.info(`seed: admin inicial criado (${email})`);
    } else {
      logger.warn('seed: ADMIN_INITIAL_EMAIL/PASSWORD nao definidos; admin nao criado');
    }
  }

  // Config padrao (so insere se ainda nao existir a linha singleton).
  await query(
    `INSERT INTO config (id, dados) VALUES (1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(CONFIG_PADRAO)],
  );

  await seedPlanosExemplo();
}

// Planos ILUSTRATIVOS para o agente conseguir simular em teste. Substituir pela tabela real da CALT
// (aba Planos ou import). So insere quando a tabela esta vazia. Parcela = credito*(1+taxa/100)/prazo.
async function seedPlanosExemplo(): Promise<void> {
  const { rows } = await query<{ count: string }>('SELECT count(*)::text FROM planos');
  if (rows[0]?.count !== '0') return;

  const segmentos: { segmento: string; bem: string; creditos: number[]; prazos: number[]; taxa: number }[] = [
    { segmento: 'auto', bem: 'Automóvel', creditos: [30000, 50000, 70000, 90000], prazos: [60, 84, 96], taxa: 18 },
    { segmento: 'imovel', bem: 'Imóvel', creditos: [120000, 200000, 300000, 400000], prazos: [96, 116], taxa: 15 },
    { segmento: 'solar', bem: 'Energia Solar', creditos: [25500, 40000, 60000], prazos: [60, 84], taxa: 20 },
  ];

  for (const s of segmentos) {
    for (const credito of s.creditos) {
      for (const prazo of s.prazos) {
        const parcela = Math.round((credito * (1 + s.taxa / 100)) / prazo);
        await query(
          `INSERT INTO planos (segmento, bem, grupo, credito, prazo_meses, parcela, taxa_adm)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [s.segmento, s.bem, `EX-${s.segmento.toUpperCase()}`, credito, prazo, parcela, s.taxa],
        );
      }
    }
  }
  logger.info('seed: planos de exemplo inseridos (substituir pela tabela real)');
}
