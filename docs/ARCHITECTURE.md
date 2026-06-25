# Arquitetura

## Visão geral

```
WhatsApp (lead) → Evolution API → POST /api/webhook/evolution (sem auth)
                                       │
                                       ├─ media.ts: áudio/imagem → texto
                                       ├─ clientes.ts: obtém/cria cliente + salva mensagem
                                       └─ agente.ts (pipeline):
                                            1) EXTRATOR (gpt-4.1, JSON, temp 0) → intent + dados
                                            2) persiste dados determinísticos
                                            3) AGENTE (gpt-4.1, tools) → executa tools + responde
                                                 └─ whatsapp.ts: envia resposta/áudio
                                                 └─ handoff: acionar_humano → notifica Carlos

Painel (React SPA) → /api/* (JWT cookie httpOnly) → Express routers → Postgres
```

## Camadas

- **`api/routes/`** — controllers HTTP finos. Webhook é público; o resto exige `requireAuth` + `requirePermission`.
- **`api/services/`** — regra de negócio (agente, clientes, planos, dashboard, whatsapp, media, config).
- **`api/agents/`** — prompts e definições de tools (sem lógica de execução; execução fica em `services/agente.ts`).
- **`api/lib/`** — infra transversal (ai/openai, auth, logger, period, permissions).
- **`api/db/`** — pool pg + migrations idempotentes.
- **`src/`** — SPA do painel (abas, auth, libs de fetch/permissão).

## Pipeline de IA (duas chamadas)

1. **Extrator** — chamada separada, `response_format: json_object`, `temperature: 0`. Devolve `intent` +
   dados estruturados. Garante determinismo e impede o modelo de "responder como chatbot" na interpretação.
2. **Agente final** — chamada com `tools` (function calling). Loop de até 4 rodadas: executa tools, devolve
   resultados ao modelo e deixa ele formular a resposta final ao lead.

Todo request de IA passa por `api/lib/ai.ts`, que registra custo em `ai_usage`.

## Serverless (Vercel)

- `api/index.ts` re-exporta o app Express; `vercel.json` roteia `/api/*` para a function e o resto para a SPA.
- Migrations rodam uma vez por cold start (guard `garantirMigrations`), antes de qualquer rota.
- O webhook responde `200` imediatamente e processa a IA em background para não estourar o timeout do Evolution.

## Google Calendar

- `api/services/google-calendar.ts`: OAuth 2.0, refresh token cifrado e cliente da Calendar API.
- Google Calendar é a fonte de verdade dos eventos.
- `eventos` funciona como shadow/outbox para metadados do CRM e para a fila operacional do n8n.
- A leitura da agenda importa mudanças feitas diretamente no Google; escritas do CRM são enviadas ao Google.
