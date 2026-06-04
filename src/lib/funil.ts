// Espelho de api/agents/prompts.ts (FUNIL_ETAPAS/LABELS) para o Kanban e filtros.
export const FUNIL_ETAPAS = [
  'novo', 'simulacao_enviada', 'indicacao', 'em_negociacao', 'agendou_pagamento',
  'cliente_ativo', 'cliente_parceiro', 'lead_frio', 'parceria', 'documento_enviado',
  'contrato_enviado', 'sem_perfil', 'cancelado',
] as const;

export type EtapaFunil = (typeof FUNIL_ETAPAS)[number];

export const FUNIL_LABELS: Record<string, string> = {
  novo: 'Novo',
  simulacao_enviada: 'Simulação Enviada',
  indicacao: 'Indicação',
  em_negociacao: 'Em Negociação',
  agendou_pagamento: 'Agendou Pagamento',
  cliente_ativo: 'Cliente Ativo',
  cliente_parceiro: 'Cliente de Parceiro',
  lead_frio: 'Lead Frio / Sem Retorno',
  parceria: 'Etiquetas de Parceria',
  documento_enviado: 'Documento Enviado',
  contrato_enviado: 'Contrato Enviado',
  sem_perfil: 'Não Tem Perfil',
  cancelado: 'Cancelado',
};

export interface Cliente {
  id: string;
  nome: string | null;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  profissao: string | null;
  renda_aproximada: number | null;
  etapa: string;
  origem: string | null;
  vip: boolean;
  pretensao_bem?: string | null;
  credito_pretendido?: number | null;
  urgencia?: string | null;
  qualificacao_completa?: boolean;
  criado_em: string;
}
