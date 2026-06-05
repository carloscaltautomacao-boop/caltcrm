# Roadmap

## Fase 0 — Fundação (concluída no scaffold)
- [x] Estrutura de pastas (tronco) + infra (Vite/Vercel/TS).
- [x] Schema do domínio (consórcio) + migrations idempotentes + seed admin/config.
- [x] Pipeline de IA (extrator + agente com tools) + tracking de custo (`ai_usage`).
- [x] Webhook do Evolution (texto/áudio/imagem) + envio WhatsApp.
- [x] Painel: Dashboard, Kanban, Clientes, Chat, Configurações + auth (JWT/permissões).

## Fase 1 — Agenda e follow-up
- [x] Aba **Agenda/Calendário** (tabela `eventos`): tarefas/lembretes/compromissos manuais + views mês/lista.
- [x] Handoff vira **tarefa** na agenda (`criarTarefaHandoff`).
- [x] **Régua de follow-up** configurável para leads frios (cron diário) + reativação contextual single-shot.
- [x] Cancelamento/reinício da régua a cada engajamento do lead.
- [ ] Gatilhos extras de reativação (ex.: simulação enviada sem retorno; aniversário do lead).
- [ ] Granularidade fina do cron (hoje diário no Hobby) — disparador externo ou plano Pro.
- [ ] Estado de `acao_pendente` para confirmações em curso.
- [ ] Onboarding estrito (parser de nome rejeitando números/frases longas).

## Fase 2 — Dados e integrações
- [ ] Importação da base atual do Excel (planilha → clientes/planos).
- [ ] Leitura do Asaas (status financeiro do cliente ativo).

## Fase 3 — Vendas avançadas
- [ ] Relatórios financeiros/operacionais (aba Relatórios).
- [ ] Simulação detalhada de lances (programada por grupo/capital).

## Fase 4 — Qualidade e escala
- [ ] Áudios humanizados por etapa do funil.
- [ ] Testes de carga do webhook; fila para processamento assíncrono.
