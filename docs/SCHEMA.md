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
**primeira_resposta_em** (KPI), criado_em, atualizado_em.

### `qualificacoes` — 1:1 com cliente
cliente_id PK, pretensao_bem (`carro`/`imovel`/`solar`), tipo_bem, credito_pretendido, urgencia
(`imediato`/`programado`), **completa** (todos os obrigatórios preenchidos).

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

### `config` — linha única (singleton id=1)
`dados` jsonb: persona, credito_minimo_perfil, follow_up_horas, custo_ia_teto_usd_mes, segmentos,
handoff {carlos, rayane}, audio_explicativo_url.

## Funil (etapa)
`novo` → `simulacao_enviada` · `indicacao` · `em_negociacao` · `agendou_pagamento` · `cliente_ativo` ·
`cliente_parceiro` · `lead_frio` · `parceria` · `documento_enviado` · `contrato_enviado` · `sem_perfil` · `cancelado`.

## Qualificação obrigatória (define `completa`)
nome, cidade, profissão, renda, pretensão de bem, crédito pretendido, urgência. (Bolsa Família e
"entende consórcio" são coletados mas não bloqueiam a conclusão.)
