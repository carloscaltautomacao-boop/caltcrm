import { describe, it, expect } from 'vitest';
import { resolverEnderecos } from '../api/services/whatsapp.ts';

// Regressao do bug em que a IA gerava a resposta mas ela nunca chegava no WhatsApp do lead.
// Causa: lead de trafego pago chega em "LID addressing mode" (remoteJid = `...@lid`, numero real em
// remoteJidAlt). Responder no numero/@s.whatsapp.net devolvia status ERROR; so o `@lid` completo entrega.
describe('resolverEnderecos', () => {
  it('lead em LID addressing mode: entrega no @lid completo, dedup pelo numero real (com 9)', () => {
    // Payload real observado no message store da instancia carloscanopus.
    const key = {
      remoteJid: '178843210006771@lid',
      remoteJidAlt: '558688454343@s.whatsapp.net',
      addressingMode: 'lid',
    };
    const r = resolverEnderecos(key, {});
    expect(r.jidEntrega).toBe('178843210006771@lid');
    expect(r.telefone).toBe('5586988454343'); // canonicaliza com o 9 para dedup
  });

  it('detecta LID pelo sufixo @lid mesmo sem addressingMode', () => {
    const key = { remoteJid: '20186497286277@lid', remoteJidAlt: '558688636999@s.whatsapp.net' };
    const r = resolverEnderecos(key, {});
    expect(r.jidEntrega).toBe('20186497286277@lid');
    expect(r.telefone).toBe('5586988636999');
  });

  it('prefere senderPn para o telefone quando presente', () => {
    const key = { remoteJid: '178843210006771@lid', addressingMode: 'lid' };
    const r = resolverEnderecos(key, { senderPn: '5586988454343' });
    expect(r.jidEntrega).toBe('178843210006771@lid');
    expect(r.telefone).toBe('5586988454343');
  });

  it('contato salvo (@s.whatsapp.net, sem LID): entrega nos digitos puros do numero', () => {
    const key = { remoteJid: '558688636999@s.whatsapp.net' };
    const r = resolverEnderecos(key, {});
    expect(r.jidEntrega).toBe('558688636999'); // sem sufixo, so digitos
    expect(r.telefone).toBe('5586988636999');
  });

  it('numero ja com o 9 no @s.whatsapp.net permanece intacto', () => {
    const key = { remoteJid: '5586999651602@s.whatsapp.net' };
    const r = resolverEnderecos(key, {});
    expect(r.jidEntrega).toBe('5586999651602');
    expect(r.telefone).toBe('5586999651602');
  });
});
