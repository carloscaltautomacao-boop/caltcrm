import type OpenAI from 'openai';
import { chat } from '../lib/ai.ts';
import { MODELOS } from '../lib/openai.ts';
import { logger } from '../lib/logger.ts';
import { EXTRATOR_PROMPT, montarSystemAgente } from '../agents/prompts.ts';
import { TOOLS } from '../agents/tools.ts';
import { getConfig } from './config.ts';
import { sendWhatsAppText, dividirEmBaloes, calcularDelayDigitacao } from './whatsapp.ts';
import {
  type Cliente,
  atualizarCliente,
  salvarMensagem,
  historicoMensagens,
  upsertQualificacao,
  recalcularQualificacao,
  registrarPrimeiraRespostaSeNecessario,
  ultimaMensagemEntradaId,
  textoEntradaDesdeUltimaSaida,
} from './clientes.ts';
import { buscarPlanosCompativeis, planosPorIds, formatarSimulacao } from './planos.ts';
import { query } from '../db/pool.ts';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Entrada do webhook com BUFFER (debounce): o lead costuma mandar a mensagem picada em vários balões.
// Em vez de responder a cada balão, espera `buffer_segundos` sem novidade e processa o burst inteiro junto.
// Estratégia: cada mensagem que chega já foi salva no banco; esta função dorme o tempo do buffer e, ao
// acordar, só processa se ela ainda for a ÚLTIMA mensagem de entrada (senão, a invocação mais nova assume).
// `minhaMensagemId` é o id da mensagem que disparou esta invocação.
export async function processarComBuffer(
  cliente: Cliente,
  textoEntrada: string,
  minhaMensagemId: string,
): Promise<void> {
  const config = await getConfig();
  const segundos = Math.max(0, Number(config.buffer_segundos) || 0);

  if (segundos === 0) {
    await processarMensagem(cliente, textoEntrada);
    return;
  }

  await sleep(segundos * 1000);

  // Chegou mensagem mais nova durante a espera? Então deixa a invocação dela processar (evita resposta dupla).
  const ultimaId = await ultimaMensagemEntradaId(cliente.id);
  if (ultimaId && ultimaId !== minhaMensagemId) {
    logger.info('buffer: mensagem mais nova chegou, abortando esta invocacao', { clienteId: cliente.id });
    return;
  }

  // Sou a última: agrupa tudo que o lead mandou desde a última resposta e processa de uma vez.
  const agrupado = await textoEntradaDesdeUltimaSaida(cliente.id);
  await processarMensagem(cliente, agrupado || textoEntrada);
}

// Pipeline principal: recebe o lead ja persistido + o texto normalizado da ultima mensagem.
export async function processarMensagem(cliente: Cliente, textoEntrada: string): Promise<void> {
  const config = await getConfig();
  const historico = await historicoMensagens(cliente.id, 20);

  // ---- 1) EXTRATOR (JSON estrito, temp 0): determinismo na interpretacao ----
  const extracao = await rodarExtrator(historico, textoEntrada, cliente.id);
  await aplicarDadosExtraidos(cliente, extracao);

  // Recarrega estado de qualificacao apos aplicar o que o extrator pegou.
  const { faltando } = await recalcularQualificacao(cliente.id);
  const clienteAtual = await recarregar(cliente.id);

  // ---- 2) AGENTE FINAL (com tools) ----
  const system = montarSystemAgente({
    treinamento: {
      persona: config.persona,
      regras_atendimento: config.regras_atendimento,
      roteiro_atendimento: config.roteiro_atendimento,
      faq: config.faq,
      base_conhecimento: config.base_conhecimento,
    },
    nomeCliente: clienteAtual.nome,
    etapaAtual: clienteAtual.etapa,
    qualificacaoFaltando: faltando,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    ...historico.map((m) => ({
      role: (m.direcao === 'in' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.conteudo ?? '',
    })),
    { role: 'user', content: textoEntrada },
  ];

  // Loop de tool calling (max 4 rodadas para evitar loop infinito).
  for (let rodada = 0; rodada < 4; rodada++) {
    const resp = await chat({ origem: 'agente', model: MODELOS.agente, messages, tools: TOOLS, clienteId: cliente.id });
    const choice = resp.choices[0]!;
    const msg = choice.message;
    messages.push(msg as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    if (msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        const resultado = await executarTool(clienteAtual, tc);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(resultado) });
      }
      continue; // deixa o modelo formular a resposta final apos as tools
    }

    // Sem tool call -> resposta final ao lead.
    const texto = msg.content?.trim();
    if (texto) await responderLead(clienteAtual, texto);
    return;
  }
  logger.warn('agente: limite de rodadas de tool atingido', { clienteId: cliente.id });
}

interface Extracao {
  intent: string;
  dados: Record<string, unknown>;
  confianca?: number;
}

async function rodarExtrator(
  historico: { direcao: string; conteudo: string | null }[],
  texto: string,
  clienteId: string,
): Promise<Extracao> {
  const contexto = historico.map((m) => `${m.direcao === 'in' ? 'Lead' : 'IA'}: ${m.conteudo}`).join('\n');
  try {
    const resp = await chat({
      origem: 'extrator',
      model: MODELOS.extrator,
      temperature: 0,
      jsonMode: true,
      clienteId,
      messages: [
        { role: 'system', content: EXTRATOR_PROMPT },
        { role: 'user', content: `Histórico:\n${contexto}\n\nÚltima mensagem do lead: ${texto}` },
      ],
    });
    return JSON.parse(resp.choices[0]?.message.content ?? '{}') as Extracao;
  } catch (e) {
    logger.error('extrator: falha ao interpretar', e);
    return { intent: 'outro', dados: {} };
  }
}

// Persiste os dados deterministicos que o extrator capturou (sem depender das tools do agente).
async function aplicarDadosExtraidos(cliente: Cliente, ex: Extracao): Promise<void> {
  const d = ex.dados || {};
  const patch: Partial<Cliente> = {};
  if (d.nome) patch.nome = String(d.nome);
  if (d.cidade) patch.cidade = String(d.cidade);
  if (d.estado) patch.estado = String(d.estado);
  if (d.profissao) patch.profissao = String(d.profissao);
  if (typeof d.renda_aproximada === 'number') patch.renda_aproximada = d.renda_aproximada;
  if (typeof d.recebe_bolsa_familia === 'boolean') patch.recebe_bolsa_familia = d.recebe_bolsa_familia;
  if (typeof d.entende_consorcio === 'boolean') patch.entende_consorcio = d.entende_consorcio;
  if (Object.keys(patch).length) await atualizarCliente(cliente.id, patch);

  if (d.pretensao_bem || d.tipo_bem || d.credito_pretendido || d.urgencia) {
    await upsertQualificacao(cliente.id, {
      pretensao_bem: d.pretensao_bem ? String(d.pretensao_bem) : undefined,
      tipo_bem: d.tipo_bem ? String(d.tipo_bem) : undefined,
      credito_pretendido: typeof d.credito_pretendido === 'number' ? d.credito_pretendido : undefined,
      urgencia: d.urgencia ? String(d.urgencia) : undefined,
    });
  }
}

// Executa uma tool chamada pelo agente. Retorna um objeto que volta para o modelo.
async function executarTool(
  cliente: Cliente,
  tc: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
): Promise<unknown> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(tc.function.arguments || '{}');
  } catch { /* args vazio */ }
  const nome = tc.function.name;
  logger.info('tool', { nome, clienteId: cliente.id, args });

  switch (nome) {
    case 'registrar_dados_cliente': {
      await atualizarCliente(cliente.id, args as Partial<Cliente>);
      return { ok: true };
    }
    case 'registrar_qualificacao': {
      const r = await upsertQualificacao(cliente.id, args as never);
      return { ok: true, completa: r.completa, faltando: r.faltando };
    }
    case 'buscar_planos': {
      const planos = await buscarPlanosCompativeis(
        String(args.segmento), Number(args.credito), args.prazo_meses ? Number(args.prazo_meses) : undefined,
      );
      return { planos };
    }
    case 'enviar_simulacao': {
      const planos = await planosPorIds((args.plano_ids as number[]) ?? []);
      await registrarSimulacao(cliente.id, String(args.segmento), Number(args.credito), planos);
      await atualizarCliente(cliente.id, { etapa: 'simulacao_enviada' });
      await responderLead(cliente, formatarSimulacao(planos));
      return { ok: true, enviados: planos.length };
    }
    case 'responder_faq':
      return { ok: true, topico: args.topico };
    case 'atualizar_etapa': {
      await atualizarCliente(cliente.id, { etapa: String(args.etapa) });
      return { ok: true };
    }
    case 'acionar_humano': {
      await acionarHumano(cliente, String(args.motivo), args.resumo ? String(args.resumo) : '');
      return { ok: true };
    }
    case 'encaminhar_contato': {
      const config = await getConfig();
      const destino = String(args.destino);
      const numero = destino === 'rayane' ? config.handoff.rayane : config.handoff.carlos;
      return { ok: true, contato: numero, destino };
    }
    default:
      return { ok: false, erro: 'tool desconhecida' };
  }
}

async function registrarSimulacao(clienteId: string, segmento: string, credito: number, planos: unknown[]): Promise<void> {
  const { rows } = await query<{ n: string }>(`SELECT 'SIM-' || lpad(nextval('simulacao_seq')::text, 6, '0') AS n`);
  await query(
    `INSERT INTO simulacoes (numero, cliente_id, segmento, credito, planos) VALUES ($1, $2, $3, $4, $5)`,
    [rows[0]!.n, clienteId, segmento, credito, JSON.stringify(planos)],
  );
}

async function acionarHumano(cliente: Cliente, motivo: string, resumo: string): Promise<void> {
  await query(
    `INSERT INTO handoffs (cliente_id, motivo, destino) VALUES ($1, $2, 'carlos')`,
    [cliente.id, motivo],
  );
  await query(`UPDATE sessoes SET status = 'humano' WHERE cliente_id = $1 AND status = 'ativa'`, [cliente.id]);
  // Notifica o Carlos no WhatsApp.
  const config = await getConfig();
  if (config.handoff.carlos) {
    const linha = `*Novo lead qualificado para fechamento*\nNome: ${cliente.nome || '(s/ nome)'}\nCidade: ${cliente.cidade || '-'}\nMotivo: ${motivo}\n${resumo}\nWhatsApp: ${cliente.telefone}`;
    await sendWhatsAppText(config.handoff.carlos, linha);
  }
  logger.info('handoff: humano acionado', { clienteId: cliente.id, motivo });
}

async function responderLead(cliente: Cliente, texto: string): Promise<void> {
  // Responde no JID roteavel gravado pelo webhook (whatsapp_jid): o `@lid` completo para leads em LID
  // addressing mode, ou os digitos do numero para contato salvo. Cadastro antigo sem jid cai no telefone.
  const destino = cliente.whatsapp_jid || cliente.telefone;
  const config = await getConfig();

  // Divide o textão em balões (mais humano) e manda cada um com "digitando..." antes. Cada balão vira uma
  // linha 'out' no historico/CRM, fiel ao que o lead recebeu. Toggles desligam cada comportamento.
  const baloes = config.dividir_mensagens ? dividirEmBaloes(texto) : [texto.trim()].filter(Boolean);
  for (const balao of baloes) {
    const delay = config.digitacao_humanizada ? calcularDelayDigitacao(balao) : 0;
    await sendWhatsAppText(destino, balao, delay);
    await salvarMensagem(cliente.id, 'out', 'texto', balao, 'ia');
  }
  await registrarPrimeiraRespostaSeNecessario(cliente.id);
}

async function recarregar(id: string): Promise<Cliente> {
  const { rows } = await query<Cliente>('SELECT * FROM clientes WHERE id = $1', [id]);
  return rows[0]!;
}
