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
