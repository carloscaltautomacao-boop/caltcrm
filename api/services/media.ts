import { descreverImagem, transcreverAudio } from '../lib/ai.ts';
import { logger } from '../lib/logger.ts';

export type TipoMensagem = 'texto' | 'audio' | 'imagem' | 'desconhecido';

export interface EntradaNormalizada {
  tipo: TipoMensagem;
  texto: string; // sempre vira texto antes do extrator
}

// Estrutura simplificada da mensagem que o Evolution entrega em MESSAGES_UPSERT.
interface EvoMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  audioMessage?: { url?: string };
  imageMessage?: { caption?: string };
  base64?: string; // alguns setups do Evolution anexam o base64 da midia aqui
}

// Converte qualquer mensagem suportada (texto/audio/imagem) em TEXTO para o pipeline.
export async function normalizarEntrada(msg: EvoMessage, clienteId?: string): Promise<EntradaNormalizada> {
  // Texto
  const texto = msg.conversation || msg.extendedTextMessage?.text;
  if (texto) return { tipo: 'texto', texto };

  // Audio -> transcricao (Whisper)
  if (msg.audioMessage) {
    try {
      const buffer = await baixarMidia(msg.base64, msg.audioMessage.url);
      if (buffer) {
        const transcricao = await transcreverAudio(buffer, clienteId);
        return { tipo: 'audio', texto: transcricao };
      }
    } catch (e) {
      logger.error('media: falha ao transcrever audio', e);
    }
    return { tipo: 'audio', texto: '[audio recebido, nao foi possivel transcrever]' };
  }

  // Imagem -> visao
  if (msg.imageMessage) {
    const legenda = msg.imageMessage.caption ? `Legenda: ${msg.imageMessage.caption}\n` : '';
    try {
      if (msg.base64) {
        const descricao = await descreverImagem(msg.base64, 'image/jpeg', clienteId);
        return { tipo: 'imagem', texto: `${legenda}[imagem] ${descricao}` };
      }
    } catch (e) {
      logger.error('media: falha ao descrever imagem', e);
    }
    return { tipo: 'imagem', texto: `${legenda}[imagem recebida]` };
  }

  return { tipo: 'desconhecido', texto: '' };
}

async function baixarMidia(base64?: string, url?: string): Promise<Buffer | null> {
  if (base64) return Buffer.from(base64, 'base64');
  if (url) {
    const r = await fetch(url);
    if (r.ok) return Buffer.from(await r.arrayBuffer());
  }
  return null;
}
