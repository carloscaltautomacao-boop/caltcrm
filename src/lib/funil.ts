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
  email: string | null;
  cpf_cnpj: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  melhor_horario_contato: string | null;
  observacoes: string | null;
  recebe_bolsa_familia: boolean | null;
  entende_consorcio: boolean | null;
  etapa: string;
  origem: string | null;
  tags: string[];
  vip: boolean;
  pretensao_bem?: string | null;
  tipo_bem?: string | null;
  credito_pretendido?: number | null;
  urgencia?: string | null;
  valor_parcela_ideal?: number | null;
  forma_contemplacao?: string | null;
  interesse_lance?: boolean | null;
  valor_lance?: number | null;
  prazo_desejado?: number | null;
  qualificacao_completa?: boolean;
  criado_em: string;
}
