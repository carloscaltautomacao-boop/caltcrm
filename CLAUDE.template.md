# CLAUDE.md

Guia operacional do projeto **{{NOME_DO_PROJETO}}**. Porta de entrada de qualquer sessão de trabalho.
Leia inteiro antes de mexer no código.

## O que este sistema faz

{{DESCRICAO_CURTA}} — agente de IA que atende **{{QUEM_FALA_COM_O_AGENTE}}** pelo WhatsApp.
Recebe {{TIPOS_DE_MENSAGEM}}, {{O_QUE_O_AGENTE_FAZ}}, e responde intents administrativas:
{{LISTA_DE_INTENTS}}.

Stack: **React 19 + Vite** (painel) · **Node 22 + Express + TypeScript** (backend serverless Vercel) ·
**Supabase Postgres** (`pg_trgm`, `unaccent`, `uuid-ossp`) · **Evolution API** (gateway WhatsApp) ·
**{{PROVEDOR_IA}}** ({{MODELOS}}).

## Como rodar

```
npm install
cp .env.example .env   # preencher chaves
npm run dev            # http://localhost:3000
npm run lint           # typecheck
npm test               # testes
npm run build:all      # build frontend + servidor
```

Variáveis em `.env` (modelo em `.env.example`): `OPENAI_API_KEY` (ou {{PROVEDOR_IA}}), `DATABASE_URL`,
`SUPABASE_URL`, `SUPABASE_KEY`, `EVO_URL`, `EVO_INSTANCE`, `EVO_APIKEY`, `GLOBAL_EVO_APIKEY`,
`VITE_APP_URL`, `JWT_SECRET`, `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD`.

## Deploy

- Hospedado na **Vercel** ({{URL_PUBLICA}}). Push em `main` dispara deploy automático.
- Webhook do Evolution aponta para `${VITE_APP_URL}/api/webhook/evolution`. Reconfigurar pela aba
  Configurações se a URL mudar.

## Onde mexer pra cada coisa

| Mexer em…                              | Arquivo                                  |
| -------------------------------------- | ---------------------------------------- |
| Bootstrap Express + routers            | `api/server.ts`                          |
| Entry point Vercel                     | `api/index.ts`                           |
| Pool pg                                | `api/db/pool.ts`                         |
| Migrations / schema                    | `api/db/migrations.ts`                   |
| Webhook do Evolution (pipeline)        | `api/routes/webhook.ts`                  |
| Prompts (extrator + agente final)      | `api/agents/prompts.ts`                  |
| Tools (function calling)               | `api/agents/tools.ts`                    |
| Mídia (áudio/imagem/planilha/csv)      | `api/services/media.ts`                  |
| Enviar WhatsApp                        | `api/services/whatsapp.ts`               |
| Dashboard (BI)                         | `api/routes/dashboard.ts` + `api/services/dashboard.ts` |
| Wrapper de IA + custo (`ai_usage`)     | `api/lib/ai.ts`                          |
| Auth (bcrypt, JWT, permissões)         | `api/lib/auth.ts` + `api/middleware/auth.ts` |
| UI do painel                           | `src/App.tsx`                            |
| {{ROTAS_DOMINIO}}                       | `api/routes/{{ARQUIVOS_DOMINIO}}.ts`     |

## Convenções de código

- TypeScript estrito; ESM; sem JSX no servidor; sem CommonJS no front.
- pt-BR em textos ao usuário e nomes de domínio no banco.
- SQL parametrizado (`$1`, `$2`); migrations idempotentes no boot.
- WhatsApp: negrito com UM asterisco `*assim*`; sem tabela `|`; listas numéricas simples.
- Commits: `feat:` / `fix:` / `chore:`.

## Modelo de auth

- Roles: `admin` (tudo) e `sub` (granular). Isolamento por {{OPERADOR}}: {{REGRA_ISOLAMENTO}}.
- JWT em cookie httpOnly (~7d); front com `credentials: 'include'`; 401 → `auth-expired` → logout.
- Webhook NÃO passa por auth (Evolution usa `apikey`).

## Coisas que parecem bugs mas são intencionais

- {{LISTAR_DECISOES_NAO_OBVIAS}}

## Custos e modelos de IA

| Uso              | Modelo            |
| ---------------- | ----------------- |
| Extrator         | {{MODELO_EXTRATOR}} |
| Resposta + tools | {{MODELO_AGENTE}}   |
| Visão            | {{MODELO_VISAO}}    |
| Áudio            | {{MODELO_AUDIO}}    |

## Módulos ativos

{{MODULOS_LIGADOS}}  (agendamento / PDF / imagem / alertas / SAC / slash)

## Roadmap

- Fase 0: documentação, modularização, logger, testes.
- Fase 1: auth + tracking de custo.
- Fase 2: dashboard BI.
- Fase 3: {{FASE_3}}.
- Fase 4: {{FASE_4}}.

## Documentação complementar

`docs/ARCHITECTURE.md` · `docs/SCHEMA.md` · `docs/FLOWS.md` · `docs/DECISIONS.md` · `docs/ROADMAP.md`

## Política de mudanças

1. `npm run lint` antes de commit.
2. Schema destrutivo só com migration versionada.
3. Ações com efeito fora do repo (deploy/push/prod) são avisadas antes.
4. Após cada fase, atualizar este arquivo + `docs/`.
