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
export function resolverEnderecos(key: EventoKey, data?: EventoKey): { telefone: string; jidEntrega?: string } {
  const remoteJid = key?.remoteJid || '';
  const remoteJidAlt = key?.remoteJidAlt || data?.remoteJidAlt || '';
  const addressingMode = key?.addressingMode || data?.addressingMode || '';
  const ehLid = addressingMode === 'lid' || remoteJid.endsWith('@lid');

  // O numero real nunca vem do @lid (que nao e telefone): so do senderPn ou de um JID @s.whatsapp.net.
  const sjid = remoteJidAlt.endsWith('@s.whatsapp.net') ? remoteJidAlt
    : remoteJid.endsWith('@s.whatsapp.net') ? remoteJid : '';
  const jidReal = data?.senderPn || key?.senderPn || sjid || '';
  const telefone = normalizarNumero(jidReal);

  const jidEntrega = ehLid
    ? (remoteJid || undefined)
    : (sjid.replace(/@s\.whatsapp\.net|@c\.us/g, '').replace(/\D/g, '') || undefined);

  return { telefone, jidEntrega };
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

// Envia para o `numero`/JID recebido EXATAMENTE como o webhook resolveu (ver routes/webhook.ts):
//  - lead em LID addressing mode -> o JID `@lid` COMPLETO (com sufixo). E o unico destino que entrega para
//    esses leads; mandar para o numero/@s.whatsapp.net devolve status ERROR e nunca chega.
//  - contato salvo (sem LID) -> os digitos puros do numero real.
// O Evolution aceita tanto digitos quanto um JID completo (`...@lid`, `...@s.whatsapp.net`) no campo `number`.
export async function sendWhatsAppText(numero: string, texto: string): Promise<void> {
  if (!EVO_URL) {
    logger.warn('whatsapp: EVO_URL nao configurado, mensagem nao enviada', { numero });
    return;
  }
  try {
    const r = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number: numero, text: texto }),
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

export async function sendWhatsAppAudio(numero: string, audioUrl: string): Promise<void> {
  if (!EVO_URL || !audioUrl) return;
  try {
    const r = await fetch(`${EVO_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ number: numero, audio: audioUrl }),
    });
    if (!r.ok) logger.error('whatsapp: sendAudio falhou', { status: r.status });
  } catch (e) {
    logger.error('whatsapp: erro de rede no sendAudio', e);
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
