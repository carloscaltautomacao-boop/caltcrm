# BRIEFING — Carlos Canopus (Consórcio)

> Consolidado a partir do briefing validado com o cliente. Tudo aqui são os "galhos" que mudam por nicho;
> o resto vem pronto do tronco (ver `arquitetura-base.md`).

## 1. Negócio
- **Empresa / nicho:** Carlos Canopus — agente/representante de **consórcio** (1 ano e 5 meses de atuação).
- **O que o agente resolve:** qualifica automaticamente leads de tráfego pago no WhatsApp — identifica
  necessidade, perfil de compra e dados preliminares — **antes** de repassar o contato para o fechamento humano (Carlos).
- **Quem fala com o agente:** **cliente final** (lead vindo de anúncio). O fechamento é 100% humano (Carlos).
- **Idioma:** pt-BR.
- **Equipe (6 pessoas):** gestor de tráfego, designer, administrativo/financeiro (Rayane — esposa),
  atendimento/suporte (sobrinha). **Vendas e fechamento centralizados no Carlos** (não há vendedores internos dedicados).
- **Volume:** 300–500 leads/mês (tráfego pago) · ~6 fechamentos/mês · R$ 300–400 mil em créditos/mês.
- **Ticket médio:** R$ 50–70 mil.
- **Sistemas atuais:** Asaas (financeiro) + Excel (controle manual). Comunicação interna por WhatsApp.
- **Dor principal:** leads chegam sem entender o produto e sem informações preliminares (origem, profissão,
  o que quer comprar, renda, se recebe Bolsa Família) antes do primeiro contato humano.

### Indicadores de sucesso (viram KPIs do dashboard)
- Aumento da **taxa de conversão** (leads → clientes).
- **Redução do tempo médio de primeira resposta.**
- Aumento do **volume de crédito qualificado/fechado**.

## 2. Domínio (vira o schema do banco)
- **Entidades principais:**
  - `cliente` (lead): nome, telefone/whatsapp, cidade, estado, profissão/ocupação, renda aproximada,
    recebe Bolsa Família (sim/não), entende consórcio (sim/não), origem, etapa do funil, tags.
  - `qualificacao`: pretensão de bem (carro/imóvel/solar), tipo/modelo do bem, crédito pretendido,
    urgência (imediato × programado), status da coleta obrigatória.
  - `plano` (catálogo p/ "tabela pronta"): segmento, crédito, prazo (meses), parcela, taxa de adm, grupo.
  - `simulacao`: planos enviados ao cliente (faixa de parcelas compatível).
  - `sessao`: ciclo de atendimento de um contato (1 ativa por contato), com `acao_pendente` e estado de onboarding.
  - `mensagem`: espelho do chat do WhatsApp (entrada/saída).
  - `handoff`: acionamento da equipe humana (Carlos / Rayane / suporte) com o motivo.
  - `ai_usage`: tracking de custo de IA.
- **Numerações/formatos:** simulação `SIM-000123` (sequencial). Sem numeração de contrato no MVP (fechamento é humano/externo).
- **Catálogo com busca fuzzy?** **Sim, tabela pronta** — buscar faixas de parcela compatíveis por
  segmento + crédito pretendido + prazo (pg_trgm/unaccent para o nome do bem/grupo; range numérico para crédito/prazo).
- **Importação existente:** dados hoje em Excel (importação opcional via planilha numa fase futura).

## 3. Agente de IA
- **Identidade:** "Assistente Virtual" (sem nome próprio definido) — assistente digital da operação.
- **Persona/tom:** consultiva, profissional, simpática, prestativa e amigável. Técnico + amigável, **altamente
  consultivo** (foco em extrair dados e entender o cliente). Tratamento por **"você"**.
- **Emojis:** permitidos **apenas nas saudações iniciais**; restante do texto limpo e profissional.
- **Primeira abordagem (já no tráfego):** *"Olá, tudo bem? Qual o seu nome e cidade por gentileza?"*.
  Se o lead não responder ao gatilho, a IA dispara um reforço para iniciar a qualificação.
- **Despedida:** a IA **não se despede formalmente** — o objetivo do fluxo é notificar o humano para assumir o chat (transição contínua).
- **Intents:**
  - `saudacao_inicio` (capturar nome + cidade)
  - `explicar_consorcio` (lead não conhece → texto curto ou áudio humanizado pré-gravado: consórcio vs financiamento)
  - `experiencia_anterior` (lead já conhece → perguntar como foi)
  - `qualificar` (coletar pretensão, tipo de bem, crédito, urgência, profissão, renda, Bolsa Família)
  - `simular` (consultar tabela de planos e enviar faixas de parcela)
  - `duvida_faq` (responder da base de conhecimento)
  - `falar_humano` / `falar_gerente`
  - `indicacao` (encaminhar Rayane / suporte)
  - `objecao` (objeções críticas → acionar humano)
  - `sem_interesse` (lead "despachado" → não forçar venda, marcar etapa)
  - `outro`
- **Tools (function calling):**
  - `registrar_dados_cliente` — nome, cidade/estado, profissão, renda, recebe Bolsa Família, entende consórcio.
  - `registrar_qualificacao` — pretensão de bem, tipo/modelo, crédito pretendido, urgência.
  - `buscar_planos` — consulta a tabela por segmento + crédito + prazo.
  - `enviar_simulacao` — registra simulação enviada e move etapa para "Simulação Enviada".
  - `responder_faq` — devolve resposta da base de conhecimento (seção 5 do briefing).
  - `enviar_audio_explicativo` — dispara o áudio humanizado pré-gravado (consórcio vs financiamento).
  - `atualizar_etapa` — move o card no funil/CRM.
  - `acionar_humano` — cria handoff e notifica a equipe (Carlos), com o motivo.
  - `encaminhar_contato` — exibe/encaminha WhatsApp da Rayane (vendas) ou notifica suporte.
- **Provedor/modelos:** OpenAI — `gpt-4.1` (extrator + agente/tools), `gpt-4o` (visão de imagem), `whisper-1` (áudio).
- **Limite/alerta de custo:** definir teto mensal em config (alerta quando `ai_usage` ultrapassar o limite).

### Limites críticos da IA (regras duras)
- Nunca inventar dados ou dar informação falsa.
- Nunca prometer valores/condições sem aprovação prévia.
- Nunca debater religião, política ou temas polêmicos.
- Nunca fornecer dados confidenciais sem autorização.
- Nunca reagir de forma rude/agressiva.
- Ser direta e consultiva; **não forçar a venda** se o lead for "despachado" (sem interesse).

## 4. Canais e mídia (Evolution)
- **Tipos de mensagem:** [x] texto · [x] áudio (transcrição Whisper) · [x] imagem (visão) · [ ] planilha · [ ] CSV · [ ] PDF.
- **Instância/Número:** WhatsApp **86999651602** (conta comercial exclusiva, em nome da Rayane/esposa).
- **Enviar mídia gerada:** **áudio humanizado pré-gravado** (consórcio vs financiamento). Sem geração de PDF/imagem no MVP.

## 5. Painel (abas e métricas)
- **Abas:** [x] Dashboard · [x] Chat · [x] Kanban · [x] Clientes · [x] Configurações · [ ] Relatórios (fase futura) · [ ] Agendamento.
- **Estágios do Kanban (tags do CRM):** Novo → Simulação Enviada · Indicação · Em Negociação · Agendou Pagamento ·
  Cliente Ativo · Cliente de Parceiro · Lead Frio/Sem Retorno · Etiquetas de Parceria · Documento Enviado ·
  Contrato Enviado · Não Tem Perfil · Cancelado.
- **KPIs do dashboard:** leads no período · taxa de conversão (clientes ativos / leads) · tempo médio de
  primeira resposta · volume de crédito qualificado e fechado · leads por etapa do funil · leads por origem ·
  distribuição por segmento (auto/imóvel/solar) · % com perfil (crédito ≥ R$ 50k).

## 6. Acesso
- **Sub-logins além do admin?** Sim — equipe (suporte/financeiro) com permissões reduzidas. Admin = Carlos.
- **Isolamento por operador?** Não no MVP — leads são da operação (centralizada no Carlos). Permissões controlam o que cada um vê/edita.
- **Permissões granulares:** `clientes.view/edit/delete`, `chat.view/send`, `kanban.edit`, `planos.view/edit`,
  `dashboard.view`, `config.view/edit`, `users.manage`, `handoff.receber`.

## 7. Módulos opcionais (ligar/desligar)
- [ ] Agendamento
- [ ] Emissão de PDF
- [ ] Geração de imagem
- [x] Alertas (custo de IA acima do teto; follow-up de lead frio em 24h)
- [x] **SAC / escalonamento para humano** (núcleo do produto — handoff para Carlos/Rayane)
- [x] Comandos slash (`/ajuda`, `/status`) — utilitários internos
- [x] Áudio humanizado pré-gravado (explicação consórcio)
- [x] Reativação/follow-up de leads frios (régua 24h)

### Critérios de acionamento humano (Carlos)
- Qualificação 100% concluída (dados coletados).
- Lead pede explicitamente falar com o gerente/responsável.
- Lead pronto para simulação detalhada de lances.
- Objeções críticas ou cenários complexos.
- Indicação de cliente VIP.
- **Pretensão de crédito acima de R$ 50.000** (abaixo disso é difícil faturar automóveis; serve mais para motos).
- **Indicações pessoais / contatos específicos:** encaminhar WhatsApp da **Rayane** (vendas) ou notificar o suporte.

## 8. Infra / deploy
- **Domínio/URL pública:** a definir (Vercel). Webhook do Evolution → `${VITE_APP_URL}/api/webhook/evolution`.
- **Hospedagem:** Vercel (auto-deploy no push para `main`).
- **Integrações externas:** Asaas (financeiro — referência atual, integração futura). Sem ERP/calendário no MVP.

## 9. Regras de negócio e exceções importantes
- A IA **não se despede** — sempre encerra acionando o humano (transição contínua).
- **Crédito < R$ 50k**: não desqualificar automaticamente, mas sinalizar baixa prioridade/perfil de moto;
  acionamento humano prioriza ≥ R$ 50k.
- **Bolsa Família** é dado de qualificação relevante (impacta perfil/aprovação) — sempre coletar e registrar.
- Segmento de **Serviços foi descontinuado** — não ofertar (só Automóveis, Imóveis, Energia Solar).
- **Lance**: oferta em percentual; pagamento em até 2 dias úteis; lance parcelado em até 4x (entrada em 2 dias,
  restante a cada 30 dias) — informação de FAQ, **não prometer condições sem aprovação**.
- **FGTS**: uso restrito, quase exclusivo para Imóveis.
- **Contemplação**: assembleias mensais (~dia 15), por sorteio ou lance — FAQ.
- **Follow-up**: régua de 24h para leads frios; reativação com gatilhos de "novos grupos" / "contemplações recentes na região".

### Base de conhecimento (FAQ) que a IA usa
- **O que é consórcio:** compra programada, união de grupo com mesmo objetivo, **sem juros**, só taxa de administração.
- **Consórcio vs financiamento:** financiamento = urgência imediata mas juros altos; consórcio = planejamento,
  parcelas justas, retirada por sorteio ou lance.
- **Contemplação:** assembleias mensais (~dia 15); sorteio (sem pressa) ou lance (urgência).
- **Lance:** oferta percentual; se vencedor, boleto pago em até 2 dias úteis; pode ser parcelado em até 4x.
- **FGTS:** permitido, uso restrito/quase exclusivo para Imóveis.
- **Desistência/multas:** cancela deixando de pagar 4 parcelas consecutivas ou na central; entra em grupo de
  cotas excluídas (sorteios mensais para reaver), com retenção da multa contratual do grupo/prazo.

### Produtos e precificação
- **Automóveis** (foco principal): carros novos/usados, caminhões, utilitários, motos, ônibus.
- **Imóveis** (menor escala): casas, apartamentos, terrenos, salas comerciais, fazendas.
- **Energia Solar**: investimento programado (com alienação de bens se necessário).
- **Crédito:** R$ 25.500 a R$ 400.000. **Prazo:** 36 a 116 meses (melhor performance ~96 meses).
  **Taxa de adm:** 12,8% a 22% (conforme prazo/plano/grupo).
