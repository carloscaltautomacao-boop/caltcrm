# Arquitetura base (o tronco replicável)

Tudo aqui é igual em (praticamente) todo projeto de agente IA + CRM. Reaproveite na íntegra.

## Stack canônica

| Camada        | Tecnologia                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Painel admin  | React 19 + Vite + TypeScript + Tailwind v4 (SPA)                           |
| Backend       | Node 22 + Express + TypeScript (serverless na Vercel; bundle via esbuild)  |
| Banco         | Supabase Postgres com extensões `pg_trgm`, `unaccent`, `uuid-ossp`         |
| WhatsApp      | Evolution API (gateway)                                                    |
| IA            | OpenAI por padrão (texto/tools, visão, transcrição) — Gemini como alternativa |
| Deploy        | Vercel (auto-deploy no push para `main`)                                   |

Convenções de IDs: itens de catálogo de alto volume podem usar `SERIAL` (int); demais entidades usam
`UUID` (`uuid-ossp`).

## Estrutura de pastas

```
projeto/
├── api/
│   ├── server.ts            # bootstrap Express + middlewares + montagem de routers
│   ├── index.ts             # entry point Vercel (só re-exporta server.ts)
│   ├── db/
│   │   ├── pool.ts          # pool pg
│   │   └── migrations.ts    # DDL idempotente (CREATE IF NOT EXISTS / ALTER ADD COLUMN IF NOT EXISTS)
│   ├── services/            # regras de negócio (search, whatsapp, media, dashboard, pdf, ...)
│   ├── agents/
│   │   ├── prompts.ts       # prompts do extrator e do agente final
│   │   └── tools.ts         # definições de tools (function calling)
│   ├── routes/
│   │   ├── webhook.ts       # /api/webhook/evolution (pipeline principal, SEM auth)
│   │   ├── auth.ts          # login, logout, me
│   │   ├── users.ts         # CRUD de usuários (admin-only)
│   │   ├── config.ts        # configurações do agente/regras/SAC/webhook
│   │   ├── dashboard.ts     # endpoints de BI
│   │   └── <dominio>.ts     # rotas específicas do nicho
│   ├── lib/
│   │   ├── ai.ts            # wrapper de chat completion + tracking de custo em ai_usage
│   │   ├── openai.ts        # client singleton do provedor de IA
│   │   ├── auth.ts          # bcrypt, JWT, mapa de PERMISSIONS
│   │   ├── logger.ts        # logger estruturado
│   │   └── period.ts        # helper de período (de/ate, default mês atual)
│   └── middleware/
│       └── auth.ts          # requireAuth, requirePermission
├── src/
│   ├── App.tsx              # painel (abas)
│   ├── auth/                # AuthContext + LoginScreen
│   ├── lib/
│   │   ├── api.ts           # wrapper de fetch
│   │   ├── install-fetch.ts # credentials include + handling de 401 (dispara auth-expired)
│   │   └── permissions.ts   # permissões espelhadas no frontend
│   └── index.css            # Tailwind v4
├── docs/                    # ARCHITECTURE, SCHEMA, FLOWS, DECISIONS, ROADMAP
├── tests/                   # *.test.ts (vitest)
├── .env.example
├── vite.config.ts
├── vercel.json
├── tsconfig.json
├── package.json
└── CLAUDE.md                # porta de entrada (gerada do template)
```

## Scripts npm padrão

| Comando             | Função                                  |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Backend Express + Vite middleware (dev) |
| `npm run lint`      | Typecheck (`tsc --noEmit`)              |
| `npm test`          | Testes (`vitest run`)                   |
| `npm run build`     | Build do frontend                       |
| `npm run build:all` | Build frontend + bundle do servidor     |
| `npm run start`     | Roda o servidor bundled (produção)      |

## Variáveis de ambiente padrão (`.env.example`)

- `OPENAI_API_KEY` (ou chave do provedor escolhido)
- `DATABASE_URL` — string completa do Supabase (sem query params)
- `SUPABASE_URL`, `SUPABASE_KEY`
- `EVO_URL`, `EVO_INSTANCE`, `EVO_APIKEY`, `GLOBAL_EVO_APIKEY`
- `VITE_APP_URL` — URL pública (usada na configuração do webhook do Evolution)
- `JWT_SECRET` — segredo do JWT do painel (≥32 chars)
- `ADMIN_INITIAL_EMAIL` + `ADMIN_INITIAL_PASSWORD` — admin inicial criado no primeiro boot se `users` vazia

> Boas práticas: nunca commitar `.env`; gerar `JWT_SECRET` com bytes aleatórios; em produção, `VITE_APP_URL`
> e URLs de backend/frontend devem ser públicas (defaults localhost só servem pra dev).

## Modelo de auth

- **Roles**: `admin` (todas as permissões implícitas) e `sub` (granular via array `permissions`).
- **Isolamento por operador**: quando um `sub` está vinculado a um operador (ex.: `users.operador_id`),
  as listagens e ações daquele domínio filtram pelos registros do próprio operador (404/403 fora disso).
- **Permissões granulares** (exemplo de catálogo, ajuste por nicho): `clientes.view/edit/delete`,
  `<dominio>.view/edit`, `dashboard.view`, `config.view/edit`, `users.manage`, etc.
- **JWT** em cookie httpOnly, ~7 dias. Frontend usa `credentials: 'include'`. Em 401, dispara `auth-expired`
  e força logout no estado local.
- **Webhook do Evolution NÃO passa por auth** (autentica via `apikey` do próprio Evolution).

## Abas-base do painel

1. **Dashboard** — KPIs e gráficos (métricas definidas no briefing).
2. **Chat** — espelho das conversas do WhatsApp.
3. **Kanban** — colunas = estágios do funil/CRM; cards arraste-e-solta (lib sugerida: dnd-kit).
4. **Clientes** — lista + histórico por cliente.
5. **Configurações** — regras do agente, SAC, reconfigurar webhook.
6. **Relatórios** — financeiros/operacionais conforme o nicho.
7. *(opcional)* **Agendamento**, quando o nicho pedir.

## Convenções de código (replicar sempre)

- TypeScript estrito; ESM em todo lugar (`"type": "module"`).
- Sem JSX no servidor; sem CommonJS no frontend.
- Textos ao usuário e nomes de domínio no banco em **pt-BR**.
- Comentário só pro WHY não-óbvio; não comentar o WHAT.
- SQL em template strings parametrizado (`$1`, `$2`) — nunca concatenar.
- Markdown do WhatsApp: negrito com UM asterisco `*assim*`; sem tabela `|`; listas numéricas simples.
- Migrations idempotentes no boot; mudança destrutiva só com migration versionada.
- Commits no padrão `feat:`/`fix:`/`chore:`.
