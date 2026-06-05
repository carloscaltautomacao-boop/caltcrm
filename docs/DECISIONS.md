# Decisões (ADR resumido)

## D1 — Pipeline de duas chamadas (extrator + agente)
Extrator separado em JSON/temp 0 garante interpretação determinística e persistência de dados mesmo se o
agente final não chamar as tools. O agente final cuida da conversa + ações.

## D2 — IA não fecha venda e não se despede
Regra do cliente: o objetivo é qualificar e **acionar o humano** (Carlos). Todo encerramento é via handoff.

## D3 — Webhook responde 200 imediatamente
O processamento de IA (transcrição, visão, múltiplas chamadas) pode demorar; responder antes evita timeout
e reentrega do Evolution. Risco aceito: erros no processamento ficam só no log (sem retry automático no MVP).

## D4 — Crédito < R$ 50k não bloqueia, só despriorizar
Briefing: abaixo disso é difícil faturar automóvel (serve mais para moto). Mantemos o lead, mas o
acionamento humano prioriza ≥ R$ 50k.

## D5 — Catálogo como "tabela pronta" (não cálculo)
Simulação consulta `planos` por faixa de crédito (±30%) + proximidade de prazo. Sem fórmula de cálculo de
parcela no MVP (evita prometer condições não aprovadas).

## D6 — Sem isolamento por operador
Operação centralizada no Carlos; permissões granulares bastam. Reavaliar se entrarem vendedores dedicados.

## D7 — Tracking de custo best-effort
Falha ao gravar `ai_usage` nunca derruba o atendimento.

## D8 — Migrations idempotentes no boot
`CREATE IF NOT EXISTS` / `ALTER ... IF NOT EXISTS`. Mudança destrutiva só com migration versionada.

## D9 — Agenda como tabela `eventos` polimórfica (não várias tabelas)
Tarefas, lembretes, compromissos (e eventualmente follow-ups vindos do n8n) compartilham os mesmos campos
(quando + o quê + status + vínculo com lead). Uma tabela com `tipo` evita duplicar CRUD/UI e deixa o handoff
"jogar" itens na mesma agenda. Custo: validações por tipo ficam no código, não no schema (aceito).

## D10 — Follow-up automático fica FORA do app (no n8n)
Tentamos um motor de reativação com cron na Vercel, mas: (1) no plano **Hobby** o cron é limitado (diário) e
atrapalhou a promoção pra produção; (2) o Carlos já usa **n8n** e prefere orquestrar follow-up lá, com mais
flexibilidade de gatilhos. Decisão: **remover cron + motor de reativação do código**; manter só a aba Agenda
(gestão de tarefas) e a API `/api/agenda`, que o n8n pode usar para criar/ler eventos. O `eventos.tipo`
`follow_up` e o índice parcial único ficam reservados caso o n8n queira gravar follow-ups na agenda.
