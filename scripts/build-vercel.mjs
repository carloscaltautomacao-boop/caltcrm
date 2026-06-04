// Build para a Vercel via Build Output API (https://vercel.com/docs/build-output-api).
//
// Por que existe: a convencao do projeto usa imports com extensao `.ts`. O runtime
// @vercel/node so transpila o entrypoint e deixa os imports `./server.ts` literais,
// estourando ERR_MODULE_NOT_FOUND. Aqui o esbuild bundla TODO o grafo do servidor
// (resolvendo os `.ts` nativamente) num unico arquivo CJS self-contained, e montamos
// manualmente a estrutura `.vercel/output` que a Vercel consome diretamente.
//
// Saida:
//   .vercel/output/config.json                       -> roteamento (API + SPA fallback)
//   .vercel/output/static/**                          -> frontend (vite build)
//   .vercel/output/functions/api/index.func/index.js  -> Express bundlado
//   .vercel/output/functions/api/index.func/.vc-config.json

import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.vercel', 'output');
const fnDir = join(out, 'functions', 'api', 'index.func');

// 0) Limpa saida anterior pra nao arrastar lixo de builds passados.
rmSync(out, { recursive: true, force: true });

// 1) Frontend. As envs VITE_* ja estao no ambiente da Vercel no momento do build.
console.log('[build-vercel] vite build...');
execSync('npm run build', { cwd: root, stdio: 'inherit', shell: true });

// 2) Bundle do servidor (resolve imports .ts). Saida ESM (.mjs): o entry expoe
//    `export { app as default }` sem depender de `module.exports` — evita o
//    clobbering que acontece ao bundlar CJS+ESM misturado pra format=cjs.
//    O banner reintroduz `require`/__dirname/__filename para deps externas
//    (ex.: pg tenta `require('pg-native')` em try/catch).
console.log('[build-vercel] bundling api...');
mkdirSync(fnDir, { recursive: true });
await build({
  entryPoints: [join(root, 'api', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: join(fnDir, 'index.mjs'),
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __f2p } from 'node:url';",
      "import { dirname as __dn } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __f2p(import.meta.url);',
      'const __dirname = __dn(__filename);',
    ].join('\n'),
  },
  // Drivers nativos opcionais que pg/ws tentam requerer em try/catch: deixe externos.
  external: ['pg-native', 'cardinal', 'bufferutil', 'utf-8-validate'],
});

// 3) Estaticos -> output/static
console.log('[build-vercel] copiando static...');
cpSync(join(root, 'dist', 'client'), join(out, 'static'), { recursive: true });

// 4) Config da funcao.
writeFileSync(
  join(fnDir, '.vc-config.json'),
  JSON.stringify(
    { runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: true, maxDuration: 180 },
    null,
    2,
  ),
);

// 5) Roteamento: /api/* -> funcao; resto -> arquivos estaticos; fallback SPA -> index.html.
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/api/(.*)', dest: '/api/index' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log('[build-vercel] ok -> .vercel/output');
