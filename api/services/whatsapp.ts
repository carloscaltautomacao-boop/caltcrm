import { logger } from '../lib/logger.ts';

const EVO_URL = process.env.EVO_URL || '';
const EVO_INSTANCE = process.env.EVO_INSTANCE || '';
const EVO_APIKEY = process.env.EVO_APIKEY || '';

function headers(): Record<string, string> {
  return { 'Content-Type': 'application/json', apikey: EVO_APIKEY };
}

// Normaliza o numero para o formato que o Evolution espera (so digitos) e canonicaliza
// celulares BR para SEMPRE incluir o nono digito. O WhatsApp ora manda o numero com o 9
// (via senderPn), ora sem o 9 (via remoteJid @lid em contas Business); sem isso o mesmo
// lead vira DOIS cadastros (ex.: 5586988636999 e 558688636999) e a conversa se parte.
export function normalizarNumero(jid: string): string {
  const digitos = jid.replace(/@s\.whatsapp\.net|@lid|@c\.us/g, '').replace(/\D/g, '');
  return canonicalizarCelularBR(digitos);
}

// Estrutura minima da `key`/`data` de um evento MESSAGES_UPSERT do Evolution (so o que usamos aqui).
export interface EventoKey {
  remoteJid?: string;
  remoteJidAlt?: string;
  addressingMode?: string;
  senderPn?: string;
}

// Resolve, a partir do evento do Evolution, os DOIS enderecos que o webhook precisa:
//  - `telefone`: numero real canonicalizado (com o 9) — chave de dedup/cadastro do lead.
//  - `jidEntrega`: o JID ROTEAVEL de ENTREGA das respostas. Para lead em LID addressing mode e o `@lid`
//    COMPLETO (com sufixo) — unico destino que entrega; responder no numero/@s.whatsapp.net devolve status
//    ERROR e nunca chega. Para contato salvo (sem LID) sao os digitos puros do numero.
export interface EnderecosResolvidos {
  // Numero real canonicalizado (com o 9) — chave de dedup/cadastro.
  telefone: string;
  // Melhor destino de ENTREGA conhecido SO pelo payload: o `@lid` se ele vier no evento; senao os digitos
  // do numero. Para lead LID o numero NAO entrega (status ERROR) — o webhook deve trocar pelo @lid resolvido.
  jidEntrega?: string;
  // true quando o contato esta em "LID addressing mode" (addressingMode === 'lid' ou ha um @lid no payload).
  ehLid: boolean;
  // O JID @s.whatsapp.net do lead (ex.: `558688454343@s.whatsapp.net`) — usado para resolver o @lid no store.
  sJidNumero?: string;
}

export function resolverEnderecos(key: EventoKey, data?: EventoKey): EnderecosResolvidos {
  const remoteJid = key?.remoteJid || '';
  const remoteJidAlt = key?.remoteJidAlt || data?.remoteJidAlt || '';
  const addressingMode = key?.addressingMode || data?.addressingMode || '';

  // O @lid pode (em algumas versoes) vir em remoteJid ou remoteJidAlt; mas no webhook do Evolution atual ele
  // NAO vem em campo nenhum — vem so o numero @s.whatsapp.net + addressingMode:'lid'. Procuramos o @lid em
  // ambos por robustez; quando ausente, o webhook resolve via store (resolverLidPorNumero).
  const candidatos = [remoteJid, remoteJidAlt];
  const lidJid = candidatos.find((j) => j.endsWith('@lid')) || '';
  const sJid = candidatos.find((j) => j.endsWith('@s.whatsapp.net')) || '';
  const ehLid = addressingMode === 'lid' || !!lidJid;

  // IDENTIDADE (dedup): numero real canonicalizado (com o 9). Vem do senderPn ou do JID @s.whatsapp.net;
  // NUNCA do @lid (que nao e telefone).
  const jidReal = data?.senderPn || key?.senderPn || sJid || '';
  const telefone = normalizarNumero(jidReal);

  const jidEntrega = lidJid
    ? lidJid
    : (sJid.replace(/@s\.whatsapp\.net|@c\.us/g, '').replace(/\D/g, '') || undefined);

  return { telefone, jidEntrega, ehLid, sJidNumero: sJid || undefined };
}

// Resolve o `@lid` de um lead a partir do seu JID @s.whatsapp.net, consultando o message store do Evolution.
// Necessario porque o webhook avisa que o contato esta em LID mode mas NAO entrega o @lid — e so o @lid
// entrega a resposta (responder no numero da status ERROR). Retorna o `...@lid` ou null se nao achar.
export async function resolverLidPorNumero(sJidNumero: string): Promise<string | null> {
  if (!EVO_URL || !sJidNumero) return null;
  try {
    const r = await fetch(`${EVO_URL}/chat/findMessages/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ where: { key: { remoteJidAlt: sJidNumero } } }),
    });
    if (!r.ok) {
      logger.error('whatsapp: resolverLid findMessages falhou', { status: r.status, sJidNumero });
      return null;
    }
    const j = (await r.json()) as { messages?: { records?: unknown[] } | unknown[] };
    const box = j?.messages as { records?: unknown[] } | unknown[] | undefined;
    const recs = (Array.isArray(box) ? box : box?.records) || [];
    for (const m of recs as { key?: { remoteJid?: string; remoteJidAlt?: string } }[]) {
      const rj = m?.key?.remoteJid;
      // confirma que o registro e mesmo desse contato (defensivo contra filtro frouxo do store)
      if (typeof rj === 'string' && rj.endsWith('@lid') && m?.key?.remoteJidAlt === sJidNumero) return rj;
    }
    return null;
  } catch (e) {
    logger.error('whatsapp: erro de rede no resolverLid', e);
    return null;
  }
}

// Celular BR completo tem 13 digitos: 55 + DDD(2) + 9 + assinante(8). Alguns eventos chegam
// sem o nono digito (12 digitos). Se for celular BR (assinante comeca em 6-9), insere o 9
// para casar com o cadastro existente. Fixos (assinante comeca em 2-5) ficam intactos.
function canonicalizarCelularBR(num: string): string {
  if (num.startsWith('55') && num.length === 12) {
    const ddd = num.slice(2, 4);
    const assinante = num.slice(4); // 8 digitos
    if (/^[6-9]/.test(assinante)) return `55${ddd}9${assinante}`;
  }
  return num;
}

// Quebra a resposta da IA em "balões" (mensagens separadas no WhatsApp) pra soar como uma pessoa digitando,
// em vez de despejar um textão. Convenção: o agente separa cada balão com uma LINHA EM BRANCO (ver o prompt
// em montarSystemAgente); aqui partimos nisso, limpamos e limitamos a MAX_BALOES — o excedente volta junto
// no último balão pra não picar demais. Texto SEM linha em branco (ex.: a simulação, que usa quebras
// simples) continua como UM balão só. Retorna [] se o texto for vazio (o chamador ignora).
const MAX_BALOES = 4;

export function dividirEmBaloes(texto: string): string[] {
  const partes = texto.split(/\n[ \t]*\n+/).map((p) => p.trim()).filter(Boolean);
  if (partes.length <= MAX_BALOES) return partes;
  // Mantém no máximo MAX_BALOES mensagens: junta o que sobrar no último balão.
  return [...partes.slice(0, MAX_BALOES - 1), partes.slice(MAX_BALOES - 1).join('\n\n')];
}

// Tempo de "digitando..." (delay do Evolution) antes de um balão: proporcional ao tamanho, com piso e teto
// pra parecer natural sem travar a função serverless (roda dentro do waitUntil, somado ao buffer + IA).
export function calcularDelayDigitacao(texto: string): number {
  return Math.min(3500, Math.max(1000, Math.round(texto.length * 45)));
}

// Envia para o `numero`/JID recebido EXATAMENTE como o webhook resolveu (ver routes/webhook.ts):
//  - lead em LID addressing mode -> o JID `@lid` COMPLETO (com sufixo). E o unico destino que entrega para
//    esses leads; mandar para o numero/@s.whatsapp.net devolve status ERROR e nunca chega.
//  - contato salvo (sem LID) -> os digitos puros do numero real.
// O Evolution aceita tanto digitos quanto um JID completo (`...@lid`, `...@s.whatsapp.net`) no campo `number`.
// `delayMs` > 0 faz o Evolution exibir "digitando..." por esse tempo ANTES de enviar (presença + pausa
// humana num unico request); o request fica bloqueado durante o delay, por isso o piso/teto em calcularDelay.
export async function sendWhatsAppText(numero: string, texto: string, delayMs = 0): Promise<void> {
  if (!EVO_URL) {
    logger.warn('whatsapp: EVO_URL nao configurado, mensagem nao enviada', { numero });
    return;
  }
  try {
    const r = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number: numero, text: texto, ...(delayMs > 0 ? { delay: delayMs } : {}) }),
    });
    const corpo = await r.text();
    if (!r.ok) {
      logger.error('whatsapp: sendText falhou', { status: r.status, body: corpo, numero });
      return;
    }
    // O Evolution responde 2xx mesmo quando a ENTREGA falha (o status ERROR vem depois, via update). Logamos
    // o status retornado para diagnostico: se vier ERROR, o destino (numero/JID) provavelmente esta errado.
    try {
      const j = JSON.parse(corpo) as { status?: string };
      if (j?.status) logger.info('whatsapp: sendText enfileirado', { numero, status: j.status });
    } catch { /* corpo nao-JSON: ignora */ }
  } catch (e) {
    logger.error('whatsapp: erro de rede no sendText', e);
  }
}

export async function sendWhatsAppAudio(numero: string, audio: string, delayMs = 0): Promise<void> {
  if (!EVO_URL || !audio) return;
  try {
    const r = await fetch(`${EVO_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number: numero, audio, ...(delayMs > 0 ? { delay: delayMs } : {}) }),
    });
    const corpo = await r.text();
    if (!r.ok) {
      logger.error('whatsapp: sendAudio falhou', { status: r.status, body: corpo, numero });
      throw new Error(`sendAudio falhou (${r.status})`);
    }
  } catch (e) {
    logger.error('whatsapp: erro de rede no sendAudio', e);
    throw e;
  }
}

export interface WhatsAppMedia {
  mediatype: 'image' | 'video' | 'document';
  mimetype: string;
  media: string;
  fileName?: string;
  caption?: string;
}

export async function sendWhatsAppMedia(numero: string, midia: WhatsAppMedia): Promise<void> {
  if (!EVO_URL || !midia.media) return;
  try {
    const r = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        number: numero,
        mediatype: midia.mediatype,
        mimetype: midia.mimetype,
        media: midia.media,
        fileName: midia.fileName,
        caption: midia.caption || undefined,
      }),
    });
    const corpo = await r.text();
    if (!r.ok) {
      logger.error('whatsapp: sendMedia falhou', { status: r.status, body: corpo, numero, mediatype: midia.mediatype });
      throw new Error(`sendMedia falhou (${r.status})`);
    }
  } catch (e) {
    logger.error('whatsapp: erro de rede no sendMedia', e);
    throw e;
  }
}

// Estado da conexao da instancia no Evolution (open | connecting | close).
export interface ConexaoStatus {
  estado: 'open' | 'connecting' | 'close' | 'desconhecido';
}

export async function obterStatusConexao(): Promise<ConexaoStatus> {
  if (!EVO_URL) return { estado: 'desconhecido' };
  try {
    const r = await fetch(`${EVO_URL}/instance/connectionState/${EVO_INSTANCE}`, { headers: headers() });
    if (!r.ok) {
      logger.error('whatsapp: connectionState falhou', { status: r.status });
      return { estado: 'desconhecido' };
    }
    const j = (await r.json()) as { instance?: { state?: string }; state?: string };
    const estado = (j.instance?.state || j.state || 'desconhecido') as ConexaoStatus['estado'];
    return { estado };
  } catch (e) {
    logger.error('whatsapp: erro de rede no connectionState', e);
    return { estado: 'desconhecido' };
  }
}

// Resultado da geracao de QR code (Evolution v2).
export interface QrCodeResultado {
  estado: ConexaoStatus['estado'];
  // Imagem do QR em data URI (data:image/png;base64,...) quando precisa parear.
  base64?: string;
  // Codigo de pareamento alternativo (digitar no WhatsApp em vez de escanear).
  pairingCode?: string;
}

// Solicita o QR code da instancia. Se ja estiver conectada, retorna estado 'open' sem QR.
export async function obterQrCode(): Promise<QrCodeResultado> {
  if (!EVO_URL) return { estado: 'desconhecido' };
  // Se ja esta conectado, nao adianta gerar QR.
  const status = await obterStatusConexao();
  if (status.estado === 'open') return { estado: 'open' };
  try {
    const r = await fetch(`${EVO_URL}/instance/connect/${EVO_INSTANCE}`, { headers: headers() });
    if (!r.ok) {
      logger.error('whatsapp: connect falhou', { status: r.status, body: await r.text() });
      return { estado: status.estado };
    }
    const j = (await r.json()) as { base64?: string; code?: string; pairingCode?: string };
    // Evolution v2 ja devolve o base64 com o prefixo data:image; normaliza por seguranca.
    let base64 = j.base64;
    if (base64 && !base64.startsWith('data:')) base64 = `data:image/png;base64,${base64}`;
    // pairingCode so e util quando e um codigo curto digitavel; o campo `code` e o payload
    // bruto do QR (nao serve para digitar), entao nao usamos como fallback.
    const pairingCode = j.pairingCode && j.pairingCode.length <= 12 ? j.pairingCode : undefined;
    return { estado: 'connecting', base64, pairingCode };
  } catch (e) {
    logger.error('whatsapp: erro de rede no connect', e);
    return { estado: status.estado };
  }
}

// (Re)configura o webhook da instancia para apontar para a URL publica do app.
export async function configurarWebhook(appUrl: string): Promise<boolean> {
  if (!EVO_URL) return false;
  try {
    const r = await fetch(`${EVO_URL}/webhook/set/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: `${appUrl}/api/webhook/evolution`,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    });
    return r.ok;
  } catch (e) {
    logger.error('whatsapp: erro ao configurar webhook', e);
    return false;
  }
}
