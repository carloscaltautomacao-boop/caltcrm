# Schema do banco

Fonte da verdade: `api/db/migrations.ts` (DDL idempotente). Extensões: `uuid-ossp`, `pg_trgm`, `unaccent`.

## Tabelas

### `users` — usuários do painel
| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| email | text unique | login |
| senha_hash | text | bcrypt |
| nome | text | |
| role | text | `admin` \| `sub` |
| permissions | text[] | permissões granulares (sub) |
| ativo | boolean | soft-delete |

### `clientes` — leads
nome, **telefone (unique, whatsapp normalizado)**, cidade, estado, profissao, renda_aproximada,
recebe_bolsa_familia, entende_consorcio, origem, **etapa** (funil), tags[], vip,
email, cpf_cnpj, data_nascimento, estado_civil, melhor_horario_contato, observacoes,
**primeira_resposta_em** (KPI), criado_em, atualizado_em.

### `qualificacoes` — 1:1 com cliente
cliente_id PK, pretensao_bem (`carro`/`imovel`/`solar`), tipo_bem, credito_pretendido, urgencia
(`imediato`/`programado`), valor_parcela_ideal, forma_contemplacao (`sorteio`/`lance`/`indefinido`),
interesse_lance, valor_lance, prazo_desejado, **completa** (todos os obrigatórios preenchidos).

### `planos` — catálogo (tabela pronta)
id serial, segmento (`auto`/`imovel`/`solar`), bem (índice trigram), grupo, credito, prazo_meses,
parcela, taxa_adm, ativo. Busca por faixa de crédito (±30%) + proximidade de prazo.

### `simulacoes`
numero (`SIM-000123`), cliente_id, segmento, credito, planos (jsonb snapshot), criado_em.

### `sessoes` — ciclo de atendimento (1 ativa por contato)
status (`ativa`/`encerrada`/`humano`), acao_pendente (jsonb), onboarding_ok, ultima_interacao.

### `mensagens` — espelho do chat
cliente_id, direcao (`in`/`out`), tipo (`texto`/`audio`/`imagem`), conteudo, origem (`lead`/`ia`/`humano`), evolution_id.

### `handoffs` — acionamento humano
cliente_id, motivo, destino (`carlos`/`rayane`/`suporte`), resolvido.

### `ai_usage` — custo de IA
modelo, origem (`extrator`/`agente`/`visao`/`audio`), tokens, custo_usd, cliente_id.

### `eventos` — agenda/calendário (espinha dorsal da aba Agenda)
cliente_id (nullable), **tipo** (`tarefa`/`lembrete`/`compromisso`/`follow_up` — este último reservado p/ uso
externo via n8n), titulo, descricao, **inicio** (timestamptz UTC), fim, dia_inteiro, **status**
(`pendente`/`concluido`/`cancelado`/`enviado`/`falhou`), canal (`whatsapp`/`ligacao`/`presencial`/`interno`),
**automatico** (gerado pelo sistema vs humano), toque, responsavel_id (→users), handoff_id (→handoffs),
payload (jsonb), concluido_em, criado_por (→users; null = sistema), criado_em, atualizado_em.
- Índice **parcial único** `uniq_followup_pendente (cliente_id) WHERE tipo='follow_up' AND status='pendente'`
  garante no máximo 1 follow-up pendente por lead.
- Datas sempre UTC; renderização em `America/Sao_Paulo` no front (`src/lib/agenda.ts`).
- Hoje o sistema só injeta evento via `criarTarefaHandoff` (handoff → tarefa). Demais eventos são manuais
  (CRUD em `/api/agenda`); follow-up automático seria criado por fora (n8n) via a mesma API.
- O Google Calendar é a fonte de verdade. Colunas `google_event_id`, `google_calendar_id`, `google_etag`,
  `google_html_link`, `google_updated_at` e `sync_error` transformam esta tabela em shadow/outbox.

### `google_calendar_conexoes` — conexão OAuth organizacional

Linha única (`id=1`) com conta/calendário conectado e refresh token cifrado em AES-256-GCM. A chave é
derivada de `JWT_SECRET`; trocar esse segredo exige reconectar o Google Calendar.

### `config` — linha única (singleton id=1)
`dados` jsonb: persona/regras/roteiro/faq/base_conhecimento, buffer_segundos, dividir_mensagens,
digitacao_humanizada, follow_up_horas (legado/inerte), custo_ia_teto_usd_mes, segmentos, handoff {carlos, rayane}.

## Funil (etapa)
`novo` → `simulacao_enviada` · `indicacao` · `em_negociacao` · `agendou_pagamento` · `cliente_ativo` ·
`cliente_parceiro` · `lead_frio` · `parceria` · `documento_enviado` · `contrato_enviado` · `sem_perfil` · `cancelado`.

## Qualificação obrigatória (define `completa`)
nome, cidade, profissão, renda, pretensão de bem, crédito pretendido, urgência. (Bolsa Família e
"entende consórcio" são coletados mas não bloqueiam a conclusão.)
