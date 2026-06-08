// Espelha api/services/anotacoes.ts. Notas livres sobre o lead, criadas no chat.
export interface Anotacao {
  id: string;
  cliente_id: string;
  texto: string;
  criado_por: string | null;
  criado_em: string;
  autor_nome: string | null;
}
