# CLAUDE.md

Guia operacional do projeto **Carlos Canopus — CRM + Agente de IA (Consórcio)**. Porta de entrada de
qualquer sessão de trabalho. Leia inteiro antes de mexer no código. Detalhes do nicho em `BRIEFING.md`.

## O que este sistema faz

CRM com agente de IA que atende **leads de consórcio** (tráfego pago) pelo WhatsApp. Recebe **texto, áudio
e imagem**, qualifica o lead de forma consultiva (nome, cidade, profissão, renda, Bolsa Família, pretensão
de bem, crédito, urgência), consulta a tabela de planos para enviar faixas de parcela e, ao concluir a
qualificação, **aciona o humano (Carlos)** para o fechamento. A IA **não fecha venda** e **não se despede**.

Intents: `saudacao_inicio`, `explicar_consorcio`, `experiencia_anterior`, `qualificar`, `simular`,
`duvida_faq`, `falar_humano`, `indicacao`, `objecao`, `sem_interesse`, `outro`.

Stack: **React 19 + Vite** (painel) · **Node 22 + Express + TypeScript** (backend serverless Vercel) ·
**Supabase Postgres** (`pg_trgm`, `unaccent`, `uuid-ossp`) · **Evolution API** (gateway WhatsApp) ·
**OpenAI** (`gpt-4.1` extrator/agente, `gpt-4o` visão, `whisper-1` áudio).

## Como rodar

```
npm install
cp .env.example .env   # preencher chaves
npm run dev            # API em :3000 + Vite em :5173 (proxy /api -> :3000)
npm run lint           # typecheck (tsc --noEmit)
npm test               # testes (vitest)
npm run build:all      # build frontend + bundle do servidor
```

Variáveis em `.env` (modelo em `.env.example`): `OPENAI_API_KEY`, `DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_KEY`, `EVO_URL`, `EVO_INSTANCE`, `EVO_APIKEY`, `GLOBAL_EVO_APIKEY`, `VITE_APP_URL`, `JWT_SECRET`,
`ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD`, `HANDOFF_WHATSAPP_CARLOS`, `HANDOFF_WHATSAPP_RAYANE`.

## Deploy

- Hospedado na **Vercel**. Push em `main` dispara deploy automático.
- Webhook do Evolution aponta para `${VITE_APP_URL}/api/webhook/evolution`. Reconfigurar pela aba
  Configurações (botão "Reconfigurar webhook") se a URL mudar.
- Número de WhatsApp da operação: **86999651602** (conta da Rayane/esposa).

## Onde mexer pra cada coisa

| Mexer em…                              | Arquivo                                                |
| -------------------------------------- | ------------------------------------------------------ |
| Bootstrap Express + routers            | `api/server.ts`                                        |
| Entry point Vercel / dev               | `api/index.ts` / `api/dev.ts`                          |
| Pool pg                                | `api/db/pool.ts`                                       |
| Migrations / schema / seed             | `api/db/migrations.ts`                                 |
| Webhook do Evolution (pipeline)        | `api/routes/webhook.ts`                                |
| Orquestração extrator+agente+tools     | `api/services/agente.ts`                               |
| Prompts (extrator + agente final)      | `api/agents/prompts.ts`                                |
| Tools (function calling)               | `api/agents/tools.ts`                                  |
| Mídia (áudio/imagem → texto)           | `api/services/media.ts`                                |
| Enviar WhatsApp / configurar webhook   | `api/services/whatsapp.ts`                             |
| Catálogo de planos / busca / simulação | `api/services/planos.ts` + `api/routes/planos.ts`      |
| Clientes/qualificação                  | `api/services/clientes.ts` + `api/routes/clientes.ts`  |
| Dashboard (BI)                         | `api/services/dashboard.ts` + `api/routes/dashboard.ts`|
| Config do agente / handoff             | `api/services/config.ts` + `api/routes/config.ts`      |
| Wrapper de IA + custo (`ai_usage`)     | `api/lib/ai.ts` + `api/lib/openai.ts`                  |
| Auth (bcrypt, JWT, permissões)         | `api/lib/auth.ts` + `api/middleware/auth.ts` + `api/lib/permissions-list.ts` |
| UI do painel / abas                    | `src/App.tsx` + `src/tabs/*`                           |

## Convenções de código

- TypeScript estrito; ESM; sem JSX no servidor; sem CommonJS no front. Imports relativos com extensão `.ts`/`.tsx`.
- pt-BR em textos ao usuário e nomes de domínio no banco.
- SQL parametrizado (`$1`, `$2`); migrations idempotentes no boot.
- WhatsApp: negrito com UM asterisco `*assim*`; sem tabela `|`; listas numéricas simples.
- Commits: `feat:` / `fix:` / `chore:`.

## Modelo de auth

- Roles: `admin` (tudo — Carlos) e `sub` (granular — equipe). Sem isolamento por operador no MVP (operação centralizada).
- JWT em cookie httpOnly (~7d); front com `credentials: 'include'`; 401 → `auth-expired` → logout.
- Webhook NÃO passa por auth (Evolution usa `apikey`).
- Permissões: ver `api/lib/permissions-list.ts` (espelhado em `src/lib/permissions.ts`).

## Coisas que parecem bugs mas são intencionais

- **A IA nunca se despede** — todo encerramento é via `acionar_humano` (transição contínua para o Carlos).
- **Webhook responde 200 na hora** e processa a IA em background (evita timeout do Evolution). O trabalho
  pós-200 roda dentro de **`waitUntil`** (`@vercel/functions`) — SEM isso a Vercel CONGELA a função após a
  resposta e nada processa (nem salvar a mensagem); foi o bug que deixava a IA sem responder ninguém. O
  **buffer** (`processarComBuffer`) faz `sleep` de `buffer_segundos` DEPOIS do 200, dentro do `waitUntil`.
  Debounce: só a última mensagem do burst processa (compara `ultimaMensagemEntradaId`); as anteriores
  abortam. `/status` não passa pelo buffer. ⚠️ Latência observada ~40-50s por resposta (buffer + rodadas de
  tool do gpt-4.1) — fica perto do `maxDuration: 60` em `build-vercel.mjs`; se estourar, cortar rodadas/buffer.
- **Treinamento da config é a fonte principal do prompt**: `montarSystemAgente` injeta os blocos de
  `config` (persona/regras/roteiro/faq/base_conhecimento). Bloco vazio cai no `TREINAMENTO_PADRAO` de
  `prompts.ts`. `getConfig` faz merge sobre `DEFAULTS`, então config antiga em prod ganha os campos novos.
- **Crédito não é mais regra do agente** — foi removido do prompt e da config. `CREDITO_PERFIL_REFERENCIA`
  (R$ 50k, fixo em `routes/dashboard.ts`) serve só ao KPI "% com perfil".
- **Serviços** foi descontinuado como produto — só Automóveis, Imóveis e Energia Solar.
- `remoteJid` pode vir `@lid` em contas Business; o webhook prefere `senderPn` (número real) quando existe.
- Falha no tracking de `ai_usage` **não derruba** o atendimento (best-effort).

## Custos e modelos de IA

| Uso              | Modelo      |
| ---------------- | ----------- |
| Extrator         | gpt-4.1     |
| Resposta + tools | gpt-4.1     |
| Visão            | gpt-4o      |
| Áudio            | whisper-1   |

Teto de custo mensal configurável em Configurações (alerta no dashboard quando ultrapassado).

## Módulos ativos

SAC/escalonamento humano (núcleo) · **treinamento da IA configurável** (persona, regras, roteiro, FAQ e base
de conhecimento na aba Configurações — fonte PRINCIPAL do comportamento; `montarSystemAgente` só monta o
esqueleto técnico em volta) · **buffer de mensagens** (debounce: agrupa os balões picados do lead antes de
responder; `config.buffer_segundos`, padrão 8s; `processarComBuffer` em `agente.ts`) · comandos slash
(`/status`) · **PWA instalável** (mobile-first).
**Desligados:** agendamento, PDF, geração de imagem, **áudio explicativo pré-gravado** (removido),
**follow-up automático** (campo `follow_up_horas` existe mas NÃO há job que dispare — continua Fase 1).

### PWA / mobile

- Painel é **mobile-first e instalável** (Android via prompt nativo; iOS via "Adicionar à Tela de Início").
- Arquivos: `public/manifest.webmanifest`, `public/sw.js` (service worker, registrado só em produção em
  `src/main.tsx`), `public/icons/*` e `public/favicon.svg`. Meta tags PWA em `index.html`.
- Ícones são **gerados** por `scripts/gen-icons.mjs` (Node puro, sem deps) — rode para regerar.
- Navegação: `AppSidebar` no desktop (lg+), `BottomNav` no mobile. Botão "Instalar app" em `InstallButton`.
- SW usa network-first para navegação e cache-first para assets versionados; **`/api` nunca é cacheado**.

## Roadmap

- **Fase 0 (feito):** scaffold, schema, pipeline IA, painel base, auth + tracking de custo, dashboard BI.
- **Fase 1:** follow-up automático de leads frios (régua 24h) + reativação com gatilhos.
- **Fase 2:** importação da base do Excel; integração de leitura com Asaas (financeiro).
- **Fase 3:** relatórios financeiros/operacionais; simulação detalhada de lances.
- **Fase 4:** áudio humanizado por etapa; testes de carga do webhook.

## Documentação complementar

`docs/ARCHITECTURE.md` · `docs/SCHEMA.md` · `docs/FLOWS.md` · `docs/DECISIONS.md` · `docs/ROADMAP.md`

## Política de mudanças

1. `npm run lint` antes de commit.
2. Schema destrutivo só com migration versionada.
3. Ações com efeito fora do repo (deploy/push/prod/webhook em produção/dados reais) são avisadas antes.
4. Após cada fase, atualizar este arquivo + `docs/`.
