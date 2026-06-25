import type OpenAI from 'openai';

// Definicoes de tools (function calling) do agente final. A execucao real esta em api/services/agente.ts.
export const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'registrar_dados_cliente',
      description: 'Salva dados cadastrais/perfil do lead conforme ele informa. Chame sempre que aparecer um dado novo.',
      parameters: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          cidade: { type: 'string' },
          estado: { type: 'string', description: 'Sigla UF, ex.: PI' },
          profissao: { type: 'string' },
          renda_aproximada: { type: 'number' },
          email: { type: 'string' },
          observacoes: { type: 'string', description: 'Informação comercial relevante sem campo específico' },
          recebe_bolsa_familia: { type: 'boolean' },
          entende_consorcio: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_qualificacao',
      description: 'Salva os dados de qualificacao do que o lead quer comprar.',
      parameters: {
        type: 'object',
        properties: {
          pretensao_bem: { type: 'string', enum: ['carro', 'imovel', 'solar'] },
          tipo_bem: { type: 'string', description: 'Modelo/descricao do bem desejado' },
          credito_pretendido: { type: 'number', description: 'Valor da carta de credito em reais' },
          urgencia: { type: 'string', enum: ['imediato', 'programado'] },
          valor_parcela_ideal: { type: 'number', description: 'Valor mensal que cabe no orçamento do lead' },
          forma_contemplacao: { type: 'string', enum: ['sorteio', 'lance', 'indefinido'] },
          interesse_lance: { type: 'boolean' },
          valor_lance: { type: 'number' },
          prazo_desejado: { type: 'number', description: 'Prazo desejado em meses' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_planos',
      description: 'Consulta a tabela interna de planos por segmento e credito pretendido. Retorna faixas de parcela.',
      parameters: {
        type: 'object',
        properties: {
          segmento: { type: 'string', enum: ['auto', 'imovel', 'solar'] },
          credito: { type: 'number', description: 'Credito pretendido em reais' },
          prazo_meses: { type: 'number', description: 'Prazo preferido (opcional)' },
        },
        required: ['segmento', 'credito'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enviar_simulacao',
      description: 'Registra e envia ao lead a simulacao com as faixas de parcela compativeis. Move a etapa para "Simulacao Enviada".',
      parameters: {
        type: 'object',
        properties: {
          segmento: { type: 'string', enum: ['auto', 'imovel', 'solar'] },
          credito: { type: 'number' },
          plano_ids: { type: 'array', items: { type: 'number' }, description: 'IDs dos planos retornados por buscar_planos' },
        },
        required: ['segmento', 'credito', 'plano_ids'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'responder_faq',
      description: 'Marca que a resposta usa a base de conhecimento (consorcio). Use o topico para registrar o assunto.',
      parameters: {
        type: 'object',
        properties: {
          topico: {
            type: 'string',
            enum: ['o_que_e', 'vs_financiamento', 'contemplacao', 'lance', 'fgts', 'desistencia'],
          },
        },
        required: ['topico'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'atualizar_etapa',
      description: 'Move o lead para outra etapa do funil/CRM.',
      parameters: {
        type: 'object',
        properties: {
          etapa: {
            type: 'string',
            enum: [
              'novo', 'simulacao_enviada', 'indicacao', 'em_negociacao', 'agendou_pagamento',
              'cliente_ativo', 'cliente_parceiro', 'lead_frio', 'parceria', 'documento_enviado',
              'contrato_enviado', 'sem_perfil', 'cancelado',
            ],
          },
        },
        required: ['etapa'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'acionar_humano',
      description: 'Aciona a equipe humana (CALT) para assumir o chat. Use quando a qualificacao terminar ou nos criterios de acionamento.',
      parameters: {
        type: 'object',
        properties: {
          motivo: {
            type: 'string',
            enum: [
              'qualificacao_completa', 'pediu_gerente', 'simulacao_lances',
              'objecao_critica', 'cliente_vip', 'credito_alto',
            ],
          },
          resumo: { type: 'string', description: 'Resumo curto do lead para o humano (1-2 frases)' },
        },
        required: ['motivo'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'encaminhar_contato',
      description: 'Encaminha/exibe o contato de uma pessoa especifica da equipe (indicacoes pessoais).',
      parameters: {
        type: 'object',
        properties: {
          destino: { type: 'string', enum: ['rayane', 'suporte'] },
        },
        required: ['destino'],
        additionalProperties: false,
      },
    },
  },
];
