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
Tarefas, lembretes, compromissos e follow-ups compartilham os mesmos campos (quando + o quê + status +
vínculo com lead). Uma tabela com `tipo` evita duplicar CRUD/UI e deixa o handoff e a régua de follow-up
"jogarem" itens na mesma agenda. Custo: validações por tipo ficam no código, não no schema (aceito).

## D10 — Follow-up via caminho single-shot (não o pipeline do agente)
O pipeline normal (buffer + rodadas de tool do gpt-4.1) leva ~40-50s por resposta. Reusá-lo num lote de cron
estouraria o `maxDuration`. A reativação é **uma** chamada ao modelo (sem tools/buffer/delay) com a persona da
config — barata, ~3-5s, cabe dezenas por execução. Trade-off: a reativação não usa tools (não simula/qualifica
sozinha); só reabre a conversa e devolve o lead ao fluxo normal quando ele responde.

## D11 — Cron diário no Hobby (régua por vencimento, não por hora exata)
A Vercel no plano Hobby só aceita cron diário (1x/dia, máx. 2 jobs). A régua é tratada por **vencimento
acumulado** ("tudo que venceu até agora"), então "24h" vira "no próximo run diário após vencer" — adequado
para reativar lead frio, e todo disparo sai no horário comercial do cron (10h BRT). O endpoint
`/api/cron/agenda` é trigger-agnóstico (aceita header `Bearer CRON_SECRET` ou `?secret=`): se um dia precisar
de granularidade fina sem migrar pra Pro, basta um disparador externo (cron-job.org / GitHub Actions).

## D12 — Régua reinicia a cada engajamento do lead
Quando o lead responde, o webhook cancela o follow-up pendente; o agente reagenda o toque 1 ao fim da
resposta (se a qualificação seguir incompleta e o lead não estiver com humano nem em etapa terminal). Assim a
contagem de "frio" sempre parte da última interação real, não de um relógio fixo desde o primeiro contato.
