import { query } from '../db/pool.ts';

export interface Cliente {
  id: string;
  nome: string | null;
  telefone: string;
  // JID ROTEAVEL para entrega das respostas no Evolution (derivado no webhook). Para lead em LID addressing
  // mode e o `@lid` completo (ex.: `178843210006771@lid`); para contato salvo sao os digitos puros do numero.
  // Pode ser null em cadastros antigos; nesse caso o envio cai no fallback por telefone.
  whatsapp_jid: string | null;
  cidade: string | null;
  estado: string | null;
  profissao: string | null;
  renda_aproximada: number | null;
  recebe_bolsa_familia: boolean | null;
  entende_consorcio: boolean | null;
  origem: string | null;
  etapa: string;
  tags: string[];
  vip: boolean;
  primeira_resposta_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

// Busca o cliente pelo telefone ou cria um novo (lead chegando). `jid` sao os digitos puros do numero real
// (destino entregavel das respostas, derivado do remoteJidAlt no webhook). Sempre que vier, grava/atualiza no
// cadastro para a resposta sair pelo numero correto (e auto-corrige cadastros antigos que guardaram @lid).
export async function obterOuCriarPorTelefone(telefone: string, jid?: string): Promise<Cliente> {
  const { rows } = await query<Cliente>('SELECT * FROM clientes WHERE telefone = $1', [telefone]);
  if (rows[0]) {
    // Atualiza o JID se mudou (ex.: cadastro antigo sem jid, ou que guardou o @lid antigo).
    if (jid && rows[0].whatsapp_jid !== jid) {
      await query('UPDATE clientes SET whatsapp_jid = $2 WHERE id = $1', [rows[0].id, jid]);
      rows[0].whatsapp_jid = jid;
    }
    return rows[0];
  }
  const novo = await query<Cliente>(
    `INSERT INTO clientes (telefone, whatsapp_jid, etapa, origem) VALUES ($1, $2, 'novo', 'trafego') RETURNING *`,
    [telefone, jid ?? null],
  );
  return novo.rows[0]!;
}

// Apaga COMPLETAMENTE o lead e tudo que estiver ligado a ele. As tabelas dependentes (mensagens,
// qualificacoes, simulacoes, sessoes, handoffs, eventos) caem por ON DELETE CASCADE no cliente_id;
// ai_usage nao tem FK, entao limpamos a parte dele a mao. Usado pelo comando de TESTE "#zerar": apos
// apagar, o proximo contato recria o cliente do zero como 'novo'. Idempotente (DELETE sem match e no-op).
export async function zerarCliente(clienteId: string): Promise<void> {
  await query('DELETE FROM ai_usage WHERE cliente_id = $1', [clienteId]);
  await query('DELETE FROM clientes WHERE id = $1', [clienteId]);
}

// Atualiza apenas os campos informados (patch parcial), sempre tocando atualizado_em.
export async function atualizarCliente(id: string, campos: Partial<Cliente>): Promise<void> {
  const permitidos: (keyof Cliente)[] = [
    'nome', 'cidade', 'estado', 'profissao', 'renda_aproximada',
    'recebe_bolsa_familia', 'entende_consorcio', 'origem', 'etapa', 'vip',
  ];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const c of permitidos) {
    if (campos[c] !== undefined) {
      sets.push(`${c} = $${i++}`);
      vals.push(campos[c]);
    }
  }
  if (!sets.length) return;
  sets.push(`atualizado_em = now()`);
  vals.push(id);
  await query(`UPDATE clientes SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

export async function registrarPrimeiraRespostaSeNecessario(id: string): Promise<void> {
  await query(
    `UPDATE clientes SET primeira_resposta_em = now() WHERE id = $1 AND primeira_resposta_em IS NULL`,
    [id],
  );
}

// Retorna o id da mensagem inserida (usado pelo buffer para saber se chegou mensagem mais nova).
export async function salvarMensagem(
  clienteId: string,
  direcao: 'in' | 'out',
  tipo: string,
  conteudo: string,
  origem: 'lead' | 'ia' | 'humano',
  evolutionId?: string,
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO mensagens (cliente_id, direcao, tipo, conteudo, origem, evolution_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [clienteId, direcao, tipo, conteudo, origem, evolutionId ?? null],
  );
  return rows[0]!.id;
}

// Id da mensagem de ENTRADA (lead) mais recente. O buffer usa isto para saber se ele ainda é o último
// a chegar antes de processar (debounce: se chegou uma mais nova, esta invocação desiste).
export async function ultimaMensagemEntradaId(clienteId: string): Promise<string | null> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM mensagens WHERE cliente_id = $1 AND direcao = 'in' ORDER BY criado_em DESC LIMIT 1`,
    [clienteId],
  );
  return rows[0]?.id ?? null;
}

// Junta o texto de todas as mensagens de ENTRADA recebidas desde a última resposta enviada (saída).
// É o "burst" que o lead mandou picado; processamos tudo de uma vez. Retorna '' se não houver nada.
export async function textoEntradaDesdeUltimaSaida(clienteId: string): Promise<string> {
  const { rows } = await query<{ conteudo: string | null }>(
    `SELECT conteudo FROM mensagens
      WHERE cliente_id = $1 AND direcao = 'in'
        AND criado_em > COALESCE(
          (SELECT max(criado_em) FROM mensagens WHERE cliente_id = $1 AND direcao = 'out'),
          'epoch'::timestamptz)
      ORDER BY criado_em ASC`,
    [clienteId],
  );
  return rows.map((r) => (r.conteudo ?? '').trim()).filter(Boolean).join('\n');
}

export async function historicoMensagens(clienteId: string, limite = 20): Promise<
  { direcao: string; conteudo: string | null }[]
> {
  const { rows } = await query<{ direcao: string; conteudo: string | null }>(
    `SELECT direcao, conteudo FROM mensagens WHERE cliente_id = $1 ORDER BY criado_em DESC LIMIT $2`,
    [clienteId, limite],
  );
  return rows.reverse();
}

// Salva/atualiza a qualificacao (upsert 1:1) e recalcula se esta completa.
export async function upsertQualificacao(
  clienteId: string,
  campos: { pretensao_bem?: string; tipo_bem?: string; credito_pretendido?: number; urgencia?: string },
): Promise<{ completa: boolean; faltando: string[] }> {
  await query(
    `INSERT INTO qualificacoes (cliente_id, pretensao_bem, tipo_bem, credito_pretendido, urgencia)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (cliente_id) DO UPDATE SET
       pretensao_bem = COALESCE(EXCLUDED.pretensao_bem, qualificacoes.pretensao_bem),
       tipo_bem = COALESCE(EXCLUDED.tipo_bem, qualificacoes.tipo_bem),
       credito_pretendido = COALESCE(EXCLUDED.credito_pretendido, qualificacoes.credito_pretendido),
       urgencia = COALESCE(EXCLUDED.urgencia, qualificacoes.urgencia),
       atualizado_em = now()`,
    [
      clienteId,
      campos.pretensao_bem ?? null,
      campos.tipo_bem ?? null,
      campos.credito_pretendido ?? null,
      campos.urgencia ?? null,
    ],
  );
  return recalcularQualificacao(clienteId);
}

// A qualificacao "completa" exige os dados obrigatorios do BRIEFING (secao 4.2).
export async function recalcularQualificacao(clienteId: string): Promise<{ completa: boolean; faltando: string[] }> {
  const { rows } = await query<{
    nome: string | null; cidade: string | null; profissao: string | null; renda_aproximada: number | null;
    pretensao_bem: string | null; credito_pretendido: number | null; urgencia: string | null;
    entende_consorcio: boolean | null;
  }>(
    `SELECT c.nome, c.cidade, c.profissao, c.renda_aproximada, c.entende_consorcio,
            q.pretensao_bem, q.credito_pretendido, q.urgencia
       FROM clientes c LEFT JOIN qualificacoes q ON q.cliente_id = c.id
      WHERE c.id = $1`,
    [clienteId],
  );
  const r = rows[0];
  const faltando: string[] = [];
  if (!r?.nome) faltando.push('nome');
  if (!r?.cidade) faltando.push('cidade');
  if (!r?.profissao) faltando.push('profissao');
  if (r?.renda_aproximada == null) faltando.push('renda');
  if (!r?.pretensao_bem) faltando.push('pretensao_bem');
  if (r?.credito_pretendido == null) faltando.push('credito_pretendido');
  if (!r?.urgencia) faltando.push('urgencia');
  const completa = faltando.length === 0;
  await query('UPDATE qualificacoes SET completa = $2 WHERE cliente_id = $1', [clienteId, completa]);
  return { completa, faltando };
}
