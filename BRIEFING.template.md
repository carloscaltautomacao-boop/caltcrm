# BRIEFING — {{NOME_DO_PROJETO}}

> Preencha COM o cliente antes de escrever qualquer código. Tudo que estiver aqui são os "galhos" que mudam
> por nicho; o resto vem pronto do tronco.

## 1. Negócio
- Empresa / nicho:
- O que o agente resolve (1–2 frases):
- Quem fala com o agente (cliente final? vendedor? operador interno?):
- Idioma das respostas (default pt-BR):

## 2. Domínio (vira o schema do banco)
- Entidades principais e seus campos (ex.: cliente, produto, pedido / quarto, hóspede, reserva):
- Numerações/formatos (ex.: `ORC-000123`, `RES-000045`):
- O agente precisa de catálogo com busca fuzzy? (sim/não — ex.: produtos, serviços)
- Importação de dados existente? (planilha, Tiny, Bling, outro):

## 3. Agente de IA
- Persona e tom:
- Lista de intents (o que o usuário pode querer): ex.: pedido, listar abertos, buscar por cliente,
  fechar, cancelar, alterar, agendar, falar com humano, outro:
- Ações que o agente executa sozinho (viram tools/function calling):
- Provedor e modelos (default OpenAI: gpt-4.1 / gpt-4o / whisper-1; alternativa Gemini):
- Limite/alerta de custo de IA:

## 4. Canais e mídia (Evolution)
- Tipos de mensagem a suportar: [ ] texto [ ] áudio [ ] imagem [ ] planilha [ ] CSV [ ] PDF
- Instância(s) do Evolution / número(s) de WhatsApp:
- Precisa enviar PDF e/ou imagem gerados (orçamento, comprovante, etc.)? (sim/não)

## 5. Painel (abas e métricas)
- Abas necessárias: [ ] Dashboard [ ] Chat [ ] Kanban [ ] Clientes [ ] Configurações [ ] Relatórios
  [ ] Agendamento [ ] outra: ____
- Estágios do Kanban (colunas do funil):
- KPIs do dashboard que importam (ex.: faturamento, ticket médio, conversão, ocupação, no-show):
- Relatórios financeiros necessários:

## 6. Acesso
- Tem sub-logins além do admin? (sim/não)
- Há isolamento por operador/vendedor? (cada um vê só o que é seu?):
- Permissões granulares relevantes:

## 7. Módulos opcionais (ligar/desligar)
- [ ] Agendamento
- [ ] Emissão de PDF
- [ ] Geração de imagem
- [ ] Alertas (preço, estoque, vencimento, no-show...)
- [ ] SAC / escalonamento para humano
- [ ] Comandos slash (/ajuda, /status)
- Outros:

## 8. Infra / deploy
- Domínio/URL pública:
- Hospedagem (default Vercel):
- Integrações externas (ERP, pagamento, calendário, etc.):

## 9. Regras de negócio e exceções importantes
- (liste qualquer comportamento "que parece bug mas é intencional" — vai virar seção no CLAUDE.md)
