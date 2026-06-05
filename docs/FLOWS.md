# Fluxos

## Fluxo ideal de atendimento (briefing seção 4.3)

1. Lead chega via anúncio; a abordagem inicial já pede **nome e cidade**.
2. A IA descobre se o lead **entende consórcio**:
   - **Não entende** → explicação curta OU `enviar_audio_explicativo` (consórcio vs financiamento).
   - **Já entende** → pergunta como foi a experiência anterior.
3. A IA coleta a **qualificação**: pretensão e tipo de bem, crédito pretendido, urgência, profissão, renda, Bolsa Família.
4. Com crédito + segmento → `buscar_planos` → `enviar_simulacao` (faixas de parcela; move etapa para "Simulação Enviada").
5. Qualificação completa → `acionar_humano` (notifica o Carlos no WhatsApp). A IA **não se despede**.

## Critérios de acionamento humano

- Qualificação 100% concluída · pediu gerente · pronto para simulação de lances · objeção crítica ·
  cliente VIP · **crédito ≥ R$ 50.000** (prioridade). Indicações pessoais → `encaminhar_contato` (Rayane/suporte).

## Pipeline técnico do webhook

`POST /api/webhook/evolution` → responde 200 → normaliza mídia → obtém/cria cliente → salva mensagem `in`
→ pré-handler de slash (`/status`) → `processarMensagem`:
extrator (JSON, temp 0) → persiste dados → agente (tools, até 4 rodadas) → responde e salva mensagem `out`.

## Onboarding / dados faltando

`recalcularQualificacao` calcula a lista `faltando`; o prompt do agente recebe essa lista e direciona a
conversa para coletar o que falta antes de acionar o humano.

## Agenda / Calendário (aba)

Tabela `eventos` polimórfica, focada em **gestão de tarefas manual**. O humano cria/edita
`tarefa`/`lembrete`/`compromisso` (CRUD em `/api/agenda`), atribui responsável, conclui/cancela. O único
evento que o sistema injeta hoje é o do **handoff**: ao `acionar_humano`, `criarTarefaHandoff` gera uma
`tarefa` "Fechar com {lead}". Views: **Agenda** (lista por dia, atrasados em vermelho — default no mobile) e
**Mês** (grid). Datas em UTC no banco, renderizadas em BRT.

## Follow-up de leads frios (externo — n8n)

O follow-up/reativação automática **não está no app** (decisão do Carlos): será orquestrado por fora, no
**n8n**. O n8n pode ler o estado pelo banco/API, criar eventos na agenda via `POST /api/agenda` e disparar
mensagens no WhatsApp por conta própria. Não há cron nem motor de reativação no código.
