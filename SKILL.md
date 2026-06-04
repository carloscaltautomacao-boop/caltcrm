---
name: agente-crm-starter
description: >-
  Ponto de partida para criar agentes de IA integrados a um CRM próprio com WhatsApp via Evolution API.
  Use SEMPRE que for iniciar um novo projeto de "agente + CRM" para um cliente/empresa, quando o usuário
  falar em começar um CRM do zero, montar a base/estrutura de um atendente de IA no WhatsApp, replicar a
  estrutura de um projeto anterior (ex.: winassistente), ou personalizar um CRM por nicho. Cobre a stack
  padrão (React+Vite / Node+Express+TS / Supabase / Evolution API / IA multimodal), a estrutura de pastas,
  o pipeline de mensagem, e os passos de personalização por nicho. Acione mesmo que o usuário não diga
  explicitamente "skill" — basta o contexto de iniciar/estruturar um novo agente de IA com CRM.
---

# Agente IA + CRM — Starter Kit

Este skill é o **ponto de partida** para cada novo projeto de agente de IA acoplado a um CRM próprio,
servindo empresas em nichos diferentes. Ele captura o que é **igual em todo projeto** (o "tronco") e
guia o que **muda por nicho** (os "galhos"), pra você nunca mais começar do zero.

Origem: extraído de projetos de referência reais (ex.: `winassistente` — distribuidora de vendas via
WhatsApp). A stack canônica abaixo é a mais madura; trate provedores de IA como intercambiáveis.

## Como usar este skill (fluxo de um projeto novo)

1. **Levante o briefing.** Abra `assets/BRIEFING.template.md`, copie para o projeto como `BRIEFING.md` e
   preencha COM o cliente (ou peça pro usuário preencher). Nada de código antes disso.
2. **Decida o que é tronco vs. galho.** Leia `references/arquitetura-base.md` — ele descreve a estrutura
   replicável em todo projeto. Tudo lá entra "de graça". O que o briefing marcou como específico do nicho
   vira tarefa de personalização.
3. **Scaffold da estrutura.** Crie a árvore de pastas do tronco (ver arquitetura-base) e os arquivos de
   infra (`.env.example`, `vite.config.ts`, `vercel.json`, `tsconfig.json`, `package.json`).
4. **Modele o domínio do nicho.** Traduza o briefing em entidades → `docs/SCHEMA.md` → migrations
   idempotentes. (Distribuidora: produtos/orçamentos. Pousada: quartos/reservas. Clínica: procedimentos/agendamentos.)
5. **Defina o agente.** Persona, lista de intents e tools (function calling) em `api/agents/`. Veja o
   pipeline em `references/padroes-evolution-ia.md`.
6. **Implemente rotas/serviços do domínio**, depois o **dashboard** (métricas do nicho) e **ative os
   módulos opcionais** que o briefing pediu (agendamento, PDF, geração de imagem, alertas).
7. **Gere o `CLAUDE.md` do projeto** a partir de `assets/CLAUDE.template.md`, preenchendo os campos `{{...}}`.
   Esse arquivo passa a ser a porta de entrada de toda sessão de trabalho naquele repositório.
8. **Conecte o Evolution e faça deploy** (webhook + variáveis de ambiente + push na `main`).

## O que é SEMPRE replicável (o tronco)

Detalhe completo em `references/arquitetura-base.md`. Resumo do que toda instância herda:

- **Stack canônica**: React 19 + Vite + TypeScript (painel admin SPA) · Node 22 + Express + TypeScript
  (backend serverless na Vercel) · Supabase Postgres (`pg_trgm`, `unaccent`, `uuid-ossp`) · Evolution API
  (gateway WhatsApp) · provedor de IA multimodal (OpenAI por padrão: texto/tools + visão + transcrição;
  Gemini como alternativa).
- **Estrutura de pastas** `api/` (server, db, services, agents, routes, lib, middleware) + `src/` (App,
  auth, lib, css) + `docs/` + `tests/`.
- **Webhook do Evolution** em `POST /api/webhook/evolution` — NÃO passa por auth (o Evolution autentica com
  `apikey` próprio). É o único endpoint público de entrada de mensagens.
- **Pipeline de mensagem multimodal** (texto/áudio/imagem/planilha/CSV) → normalização → extrator
  determinístico → agente com tools. Padrão em `references/padroes-evolution-ia.md`.
- **Auth do painel**: JWT em cookie httpOnly, roles `admin` + `sub` com permissões granulares e isolamento
  por usuário/operador quando aplicável.
- **Abas-base do painel**: Dashboard (métricas), Chat espelhado do WhatsApp, Kanban arraste-e-solta (colunas
  = estágios do CRM), Clientes (com histórico), Configurações (regras do agente, SAC, webhook), e relatórios.
- **Tracking de custo de IA** numa tabela `ai_usage` (tokens/USD/calls por modelo e por origem).
- **Convenções**: TypeScript estrito + ESM; nomes de domínio e textos de usuário em pt-BR; markdown do
  WhatsApp usa `*negrito*` (UM asterisco), sem tabelas `|`; SQL parametrizado; migrations idempotentes no boot.
- **Deploy**: Vercel, auto-deploy no push para `main`.
- **Docs vivas**: `CLAUDE.md` (porta de entrada) + `docs/{ARCHITECTURE,SCHEMA,FLOWS,DECISIONS,ROADMAP}.md`.

## O que MUDA por nicho (os galhos)

Estes itens nunca devem ser "chutados" — saem do `BRIEFING.md`:

- **Entidades de domínio e schema** (o vocabulário do negócio).
- **Persona, tom e regras do agente**; lista de **intents**; **tools** disponíveis.
- **Métricas do dashboard** que importam pro negócio.
- **Módulos opcionais ligados/desligados**: agendamento, emissão de PDF, geração de imagem, alertas, SAC.
- **Formatos e numerações** (ex.: `ORC-000123`, `RES-000045`).
- **Provedor/modelos de IA** e limites de custo.

## Regras de ouro ao usar este skill

- Sempre leia `references/arquitetura-base.md` antes de criar a estrutura, e
  `references/padroes-evolution-ia.md` antes de mexer no webhook ou no pipeline de IA.
- Não comece a codar sem `BRIEFING.md` preenchido.
- Reaproveite o tronco na íntegra; só escreva código novo para os galhos do nicho.
- Ações com efeito fora do repo (deploy, push, configurar webhook em produção, mexer em dados reais) são
  sempre confirmadas com o usuário antes — mesmo quando autorizadas no geral.
- Ao concluir uma fase, atualize o `CLAUDE.md` e o `docs/` relevantes do projeto.

## Arquivos do kit

- `references/arquitetura-base.md` — o tronco em detalhe (estrutura de pastas, stack, abas, auth, convenções).
- `references/padroes-evolution-ia.md` — webhook do Evolution, pipeline multimodal, padrão extrator+agente.
- `assets/BRIEFING.template.md` — questionário pra levantar tudo que muda por nicho.
- `assets/CLAUDE.template.md` — modelo do `CLAUDE.md` que você gera por projeto.
