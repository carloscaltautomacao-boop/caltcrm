import { query } from '../db/pool.ts';

// Notas livres sobre um lead, criadas pelo operador no chat. Diferente de eventos: nao tem "quando".

export interface Anotacao {
  id: string;
  cliente_id: string;
  texto: string;
  criado_por: string | null;
  criado_em: string;
  autor_nome: string | null;
}

export async function listarAnotacoes(clienteId: string): Promise<Anotacao[]> {
  const { rows } = await query<Anotacao>(
    `SELECT a.*, u.nome AS autor_nome
       FROM anotacoes a
       LEFT JOIN users u ON u.id = a.criado_por
      WHERE a.cliente_id = $1
      ORDER BY a.criado_em DESC`,
    [clienteId],
  );
  return rows;
}

export async function criarAnotacao(clienteId: string, texto: string, criadoPor: string | null): Promise<Anotacao> {
  const { rows } = await query<Anotacao>(
    `INSERT INTO anotacoes (cliente_id, texto, criado_por) VALUES ($1, $2, $3) RETURNING *`,
    [clienteId, texto, criadoPor],
  );
  return rows[0]!;
}

export async function excluirAnotacao(id: string, clienteId: string): Promise<void> {
  await query('DELETE FROM anotacoes WHERE id = $1 AND cliente_id = $2', [id, clienteId]);
}
