// Gera os ícones PWA (PNG) sem dependências externas — só zlib do Node 22+.
// Marca CALT: a inicial "C" em grafite com o swoosh laranja da logo por baixo.
// Rode com: node scripts/gen-icons.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// Paleta da logo.
const ORANGE = [0xe8, 0x63, 0x2b];
const CHARCOAL = [0x2b, 0x2b, 0x2b];
const WHITE = [0xff, 0xff, 0xff];

// Anti-alias simples: mistura cor sobre fundo conforme cobertura (0..1).
const mix = (fg, bg, a) => [
  Math.round(fg[0] * a + bg[0] * (1 - a)),
  Math.round(fg[1] * a + bg[1] * (1 - a)),
  Math.round(fg[2] * a + bg[2] * (1 - a)),
];

// Cobertura de um "C" (anel com abertura à direita) no ponto (px,py), local ao glifo de lado S.
function coberturaC(px, py, S, aa) {
  const cx = S / 2;
  const cy = S * 0.46; // levemente acima para abrir espaço ao swoosh
  const dx = px - cx;
  const dy = py - cy;
  const r = Math.hypot(dx, dy);
  const rO = S * 0.40;
  const rI = S * 0.255;
  // Suaviza as bordas interna/externa do anel.
  const aOut = Math.min(1, Math.max(0, (rO - r) / aa + 0.5));
  const aIn = Math.min(1, Math.max(0, (r - rI) / aa + 0.5));
  let cob = Math.min(aOut, aIn);
  if (cob <= 0) return 0;
  // Abertura do "C" à direita (setor ~ ±42° em torno do leste).
  const ang = Math.abs(Math.atan2(dy, dx)); // 0 = leste
  const meia = 0.74; // rad (~42°)
  const aGap = Math.min(1, Math.max(0, (ang - meia) / (aa / S) + 0.5));
  return cob * aGap;
}

// Cobertura do swoosh (curva quadrática tapered) no ponto (px,py), local ao glifo de lado S.
function coberturaSwoosh(px, py, S, aa, amostras) {
  let best = 0;
  for (const a of amostras) {
    const d = Math.hypot(px - a.x, py - a.y);
    const cob = Math.min(1, Math.max(0, (a.hw - d) / aa + 0.5));
    if (cob > best) best = cob;
  }
  return best;
}

function amostrasSwoosh(S) {
  const P0 = { x: 0.12 * S, y: 0.80 * S };
  const P1 = { x: 0.60 * S, y: 0.92 * S };
  const P2 = { x: 0.92 * S, y: 0.54 * S };
  const maxHW = 0.075 * S;
  const pts = [];
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const mt = 1 - t;
    const x = mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x;
    const y = mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y;
    // Mais grosso à esquerda, afina até a ponta à direita (igual à logo).
    const hw = maxHW * Math.max(0.06, Math.pow(1 - t, 0.85));
    pts.push({ x, y, hw });
  }
  return pts;
}

function desenhar(N, scale, bg, corC, corSwoosh) {
  const buf = Buffer.alloc(N * N * 4);
  const S = N * scale;
  const gx = (N - S) / 2;
  const gy = (N - S) / 2;
  const aa = Math.max(1, N / 220); // largura da transição anti-alias (px)
  const amostras = amostrasSwoosh(S);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let c = bg;
      const lx = x - gx;
      const ly = y - gy;
      if (lx >= -aa && lx <= S + aa && ly >= -aa && ly <= S + aa) {
        const cSwoosh = coberturaSwoosh(lx, ly, S, aa, amostras);
        if (cSwoosh > 0) c = mix(corSwoosh, c, cSwoosh);
        const cC = coberturaC(lx, ly, S, aa);
        if (cC > 0) c = mix(corC, c, cC);
      }
      const o = (y * N + x) * 4;
      buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 0xff;
    }
  }
  return buf;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function toPng(N, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(N * (N * 4 + 1));
  for (let y = 0; y < N; y++) {
    raw[y * (N * 4 + 1)] = 0;
    rgba.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const alvos = [
  // any/apple: marca grafite + swoosh laranja sobre branco (igual à logo).
  { nome: 'icon-192.png', N: 192, scale: 0.74, bg: WHITE, corC: CHARCOAL, corSwoosh: ORANGE },
  { nome: 'icon-512.png', N: 512, scale: 0.74, bg: WHITE, corC: CHARCOAL, corSwoosh: ORANGE },
  { nome: 'apple-touch-icon.png', N: 180, scale: 0.74, bg: WHITE, corC: CHARCOAL, corSwoosh: ORANGE },
  // maskable: fundo grafite, "C" branco + swoosh laranja, glifo na zona segura.
  { nome: 'icon-maskable-512.png', N: 512, scale: 0.56, bg: CHARCOAL, corC: WHITE, corSwoosh: ORANGE },
];

for (const a of alvos) {
  const png = toPng(a.N, desenhar(a.N, a.scale, a.bg, a.corC, a.corSwoosh));
  writeFileSync(join(OUT, a.nome), png);
  console.log('gerado', a.nome, png.length, 'bytes');
}
