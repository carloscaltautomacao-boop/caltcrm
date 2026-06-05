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
→ **cancela follow-up pendente** (lead esquentou) → pré-handler de slash (`/status`) → `processarMensagem`:
extrator (JSON, temp 0) → persiste dados → agente (tools, até 4 rodadas) → responde e salva mensagem `out`
→ **`agendarFollowUpSeNecessario`** (agenda o toque 1 se a qualificação seguir incompleta).

## Onboarding / dados faltando

`recalcularQualificacao` calcula a lista `faltando`; o prompt do agente recebe essa lista e direciona a
conversa para coletar o que falta antes de acionar o humano.

## Agenda / Calendário (aba)

Tabela `eventos` polimórfica. O humano cria/edita `tarefa`/`lembrete`/`compromisso` (CRUD em
`/api/agenda`), atribui responsável, conclui/cancela. O sistema também injeta eventos:
- **Handoff** → ao `acionar_humano`, `criarTarefaHandoff` gera uma `tarefa` "Fechar com {lead}".
- **Follow-up** → a régua cria/consome eventos `follow_up` (ver abaixo).
Views: **Agenda** (lista por dia, atrasados em vermelho — default no mobile) e **Mês** (grid). Datas em UTC
no banco, renderizadas em BRT.

## Follow-up de leads frios (régua automática)

1. Ao fim de cada resposta da IA, se a qualificação segue incompleta (e o lead não está com humano nem em
   etapa terminal), `agendarFollowUpSeNecessario` cria o **toque 1** em `now() + follow_up_toques[0]`.
2. Se o lead responde antes, o webhook **cancela** o follow-up pendente e a régua reinicia no próximo turno.
3. **Cron diário** (`/api/cron/agenda`, protegido por `CRON_SECRET`) chama `executarFollowUps`: para cada
   follow-up vencido → revalida elegibilidade → `gerarReativacao` (1 chamada single-shot ao gpt-4.1, com a
   persona da config) → envia no WhatsApp → marca `enviado` → **agenda o próximo toque**.
4. Esgotada a régua (`follow_up_toques`), o lead vai para etapa `lead_frio` e a série encerra.

Liga/desliga e configuração da régua (intervalos + instrução de reativação) na aba Configurações.
